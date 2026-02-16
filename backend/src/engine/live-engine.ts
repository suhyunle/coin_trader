import { createChildLogger } from '../logger.js';
import { config } from '../config.js';
import type { Candle, OrderBook } from '../types/index.js';
import { ATR } from '../indicators/atr.js';
import { TradingStateMachine } from '../risk/state-machine.js';
import { RiskManager } from '../risk/risk-manager.js';
import { calcPositionSize } from '../risk/position-sizer.js';
import { BithumbPrivateApi } from '../execution/bithumb-api.js';
import { AuditLog } from '../safety/audit-log.js';
import { KillSwitch } from '../safety/kill-switch.js';
import { ModeManager } from '../mode/mode-manager.js';
import type { Strategy } from '../strategy/strategy.js';
import { waitForFill } from '../execution/order-poller.js';
import type { Notifier } from '../notification/notifier.js';
import type { BithumbPublicRest } from '../market/rest-client.js';
import type { DashboardPosition, TimelineEventDto } from '../dashboard-state.js';

const log = createChildLogger('live-engine');

export type LiveEnginePositionCallback = (pos: DashboardPosition | null) => void;
export type LiveEngineEventCallback = (ev: Omit<TimelineEventDto, 'id'>) => void;

/**
 * 라이브 트레이딩 엔진
 * - 실제 빗썸 API로 주문 실행
 * - 소액 한도 강제
 * - 손절 필수
 * - 킬스위치 연동
 */
export class LiveEngine {
  private readonly atr: ATR;
  private readonly stateMachine: TradingStateMachine;
  private readonly riskMgr: RiskManager;
  private readonly api: BithumbPrivateApi;
  private readonly audit: AuditLog;
  private readonly killSwitch: KillSwitch;
  private readonly modeMgr: ModeManager;
  private readonly strategy: Strategy;
  private readonly restClient: BithumbPublicRest | null;
  private readonly notifier: Notifier | null;

  private equity: number;
  private positionQty: number = 0;
  private positionEntryPrice: number = 0;
  private positionEntryTime: number = 0;
  private currentStopLoss: number = 0;
  private lastOrderBook: OrderBook | null = null;
  private readonly onPositionChange: LiveEnginePositionCallback | undefined;
  private readonly onEvent: LiveEngineEventCallback | undefined;

  constructor(
    strategy: Strategy,
    stateMachine: TradingStateMachine,
    riskMgr: RiskManager,
    api: BithumbPrivateApi,
    audit: AuditLog,
    killSwitch: KillSwitch,
    modeMgr: ModeManager,
    restClient?: BithumbPublicRest | null,
    notifier?: Notifier | null,
    opts?: { onPositionChange?: LiveEnginePositionCallback; onEvent?: LiveEngineEventCallback },
  ) {
    this.strategy = strategy;
    this.stateMachine = stateMachine;
    this.riskMgr = riskMgr;
    this.api = api;
    this.audit = audit;
    this.killSwitch = killSwitch;
    this.modeMgr = modeMgr;
    this.restClient = restClient ?? null;
    this.notifier = notifier ?? null;
    this.onPositionChange = opts?.onPositionChange;
    this.onEvent = opts?.onEvent;
    this.atr = new ATR(config.strategy.atrPeriod);
    this.equity = config.capital.initialKrw;
  }

  /**
   * 대시보드용 포지션 스냅샷 (PAPER/LIVE 동일 스키마)
   */
  getPositionForDashboard(): DashboardPosition | null {
    if (this.positionQty <= 0) return null;
    return {
      status: 'LONG',
      qty: this.positionQty,
      entryPrice: this.positionEntryPrice,
      stopLoss: this.currentStopLoss,
      trailingStop: this.currentStopLoss,
      entryTime: this.positionEntryTime,
      equity: this.getEquity(),
    };
  }

  private notifyPositionUpdate(): void {
    this.onPositionChange?.(this.getPositionForDashboard());
  }

  private pushEvent(ev: Omit<TimelineEventDto, 'id'>): void {
    this.onEvent?.(ev);
  }

  /**
   * 기동 시 과거 캔들로 인디케이터(ATR, Donchian, EMA) 워밍업
   * 시그널 무시, 주문 없음
   */
  warmup(candles: Candle[]): void {
    for (const c of candles) {
      this.atr.update(c);
      this.strategy.onCandle(c);
    }
    log.debug({ count: candles.length }, 'Live engine warmed up');
  }

  async onCandle(candle: Candle): Promise<void> {
    if (!this.stateMachine.isActive()) return;
    if (this.killSwitch.isActivated()) return;

    this.atr.update(candle);

    // 스톱 체크 (포지션 보유 시)
    if (this.positionQty > 0 && this.atr.isReady) {
      // 트레일링 스톱 갱신
      if (candle.high > this.positionEntryPrice) {
        const newStop = candle.high - this.atr.value * config.strategy.trailingStopAtrMultiplier;
        if (newStop > this.currentStopLoss) {
          this.currentStopLoss = newStop;
        }
      }

      // 스톱 히트
      if (candle.low <= this.currentStopLoss) {
        await this.executeExit('STOP_HIT');
        return;
      }
    }

    // 전략 시그널
    const signal = this.strategy.onCandle(candle);

    if (signal.action === 'LONG_ENTRY' && this.stateMachine.isIdle()) {
      await this.executeEntry(candle);
    } else if (signal.action === 'LONG_EXIT' && this.stateMachine.isInPosition()) {
      await this.executeExit('SIGNAL');
    }
  }

  onOrderBook(ob: OrderBook): void {
    this.lastOrderBook = ob;
  }

  private async executeEntry(candle: Candle): Promise<void> {
    if (!this.atr.isReady) return;

    const spread = this.calcSpreadBps();
    const check = this.riskMgr.checkEntry({
      spread,
      atr: this.atr.value,
      equity: this.equity,
    });
    if (!check.allowed) {
      log.info({ reason: check.reason }, 'Entry blocked');
      return;
    }

    const sizing = calcPositionSize(this.equity, candle.close, this.atr.value);
    if (sizing.qty <= 0 || sizing.krwAmount <= 0) return;

    // 주문 전 현재가 검증 (캔들 종가와 티커 괴리 시 스킵)
    if (this.restClient && candle.close > 0) {
      const ticker = await this.restClient.getTicker();
      if (ticker) {
        const driftPct = (Math.abs(ticker.tradePrice - candle.close) / candle.close) * 100;
        if (driftPct > config.execution.maxPriceDriftPct) {
          log.warn(
            { candleClose: candle.close, tickerPrice: ticker.tradePrice, driftPct },
            'Entry skipped: price drift too large',
          );
          return;
        }
      }
    }

    // LIVE 소액 한도 강제
    let orderKrw = Math.min(sizing.krwAmount, config.risk.maxPositionKrw);

    // 주문 가능 정보로 마켓 상태·최소/최대·잔고 검증
    const chanceRaw = await this.api.getOrderChance();
    if (chanceRaw && typeof chanceRaw === 'object') {
      const chance = chanceRaw as Record<string, unknown>;
      const market = chance['market'] as Record<string, unknown> | undefined;
      if (market) {
        const state = String(market['state'] ?? '').toLowerCase();
        if (state && state !== 'active') {
          log.warn({ state }, 'Entry skipped: market not active');
          return;
        }
        const bid = market['bid'] as Record<string, string> | undefined;
        const minTotal = Number(bid?.['min_total'] ?? 0);
        const maxTotal = Number(market['max_total'] ?? 0);
        if (minTotal > 0 && orderKrw < minTotal) {
          log.info({ orderKrw, minTotal }, 'Entry skipped: below market min_total');
          return;
        }
        if (maxTotal > 0 && orderKrw > maxTotal) {
          orderKrw = maxTotal;
        }
      }
      const bidAccount = chance['bid_account'] as Record<string, string> | undefined;
      if (bidAccount) {
        const availableKrw = Number(bidAccount['balance'] ?? 0);
        const market = chance['market'] as Record<string, unknown> | undefined;
        const bid = market?.['bid'] as Record<string, string> | undefined;
        const minTotal = Number(bid?.['min_total'] ?? 0);
        if (availableKrw > 0 && orderKrw > availableKrw) {
          orderKrw = Math.min(orderKrw, availableKrw);
          if (minTotal > 0 && orderKrw < minTotal) {
            log.info({ availableKrw, minTotal }, 'Entry skipped: insufficient balance');
            return;
          }
        }
      }
    }

    this.stateMachine.transition('ENTRY_PENDING');
    this.pushEvent({
      ts: Date.now(),
      type: 'order',
      summary: `BUY 시장가 ${orderKrw.toLocaleString()} KRW`,
      detail: `주문 요청 (SL ${sizing.stopLoss.toLocaleString()})`,
    });
    this.audit.info('live', 'ENTRY_ATTEMPT', JSON.stringify({
      price: candle.close, krw: orderKrw, sl: sizing.stopLoss,
    }), 'LIVE');

    try {
      const result = await this.api.marketBuy(orderKrw);
      this.riskMgr.recordOrder(result.status === 'success');
      this.modeMgr.recordOrder(result.status === 'success');

      if (result.status === 'success') {
        // 체결 확인 폴링
        const fill = await waitForFill(this.api, result.orderId);
        if (!fill.filled) {
          log.warn({ orderId: result.orderId, fillStatus: fill.status }, 'Entry order not filled');
          this.audit.warn('live', 'ENTRY_NOT_FILLED', JSON.stringify(fill), 'LIVE');
          this.notifier?.notifyError('live-engine', `매수 미체결: ${fill.status}`);
          this.stateMachine.transition('IDLE');
          this.notifyPositionUpdate();
          return;
        }

        // 잔고 확인으로 실제 체결 수량 확인
        const balance = await this.api.getBalance();
        this.positionQty = balance.totalBtc;
        this.currentStopLoss = sizing.stopLoss;
        this.equity = balance.availableKrw;
        this.positionEntryTime = candle.timestamp;

        // P1: 체결 기반 평균단가 — GET /v1/order 응답 사용
        const orderInfo = await this.api.getOrder(result.orderId);
        if (orderInfo && orderInfo.filledQty > 0 && orderInfo.side === 'bid') {
          const totalKrw = orderInfo.price;
          this.positionEntryPrice = totalKrw / orderInfo.filledQty;
          log.debug({ orderId: result.orderId, totalKrw, filledQty: orderInfo.filledQty, avgPrice: this.positionEntryPrice }, 'Entry price from fill');
        } else {
          this.positionEntryPrice = candle.close;
        }

        this.stateMachine.transition('IN_POSITION');

        this.pushEvent({
          ts: candle.timestamp,
          type: 'fill',
          summary: `FILL BUY ${this.positionQty.toFixed(6)} BTC @ ${this.positionEntryPrice.toLocaleString()}`,
          detail: `Order ${result.orderId}`,
        });
        this.audit.info('live', 'ENTRY_FILLED', JSON.stringify({
          orderId: result.orderId, qty: this.positionQty, entryPrice: this.positionEntryPrice,
        }), 'LIVE');

        log.info({
          orderId: result.orderId,
          qty: this.positionQty,
          entryPrice: this.positionEntryPrice,
          sl: this.currentStopLoss,
        }, 'Live entry');

        this.notifier?.notifyEntry(this.positionEntryPrice, this.positionQty, this.currentStopLoss);
        this.notifyPositionUpdate();
      } else {
        this.stateMachine.transition('IDLE');
        this.audit.warn('live', 'ENTRY_FAILED', result.message, 'LIVE');
        log.warn({ message: result.message }, 'Entry failed');
        this.notifier?.notifyError('live-engine', `매수 실패: ${result.message}`);
        this.notifyPositionUpdate();
      }
    } catch (err) {
      this.stateMachine.transition('IDLE');
      this.riskMgr.recordOrder(false);
      this.modeMgr.recordOrder(false);
      this.audit.error('live', 'ENTRY_ERROR', String(err), 'LIVE');
      log.error({ err }, 'Entry error');
      this.notifier?.notifyError('live-engine', `매수 에러: ${String(err)}`);
      this.notifyPositionUpdate();

      // 연속 에러 시 킬스위치
      if (this.riskMgr.getOrderFailRate() > 50) {
        await this.killSwitch.activate('High order failure rate');
      }
    }
  }

  private async executeExit(reason: string): Promise<void> {
    if (this.positionQty <= 0) return;

    this.stateMachine.transition('EXIT_PENDING');
    this.pushEvent({
      ts: Date.now(),
      type: 'order',
      summary: `SELL 시장가 ${this.positionQty.toFixed(6)} BTC`,
      detail: reason,
    });
    this.audit.info('live', 'EXIT_ATTEMPT', JSON.stringify({
      reason, qty: this.positionQty,
    }), 'LIVE');

    try {
      const result = await this.api.marketSell(this.positionQty);
      this.riskMgr.recordOrder(result.status === 'success');
      this.modeMgr.recordOrder(result.status === 'success');

      if (result.status === 'success') {
        // 체결 확인 폴링
        const fill = await waitForFill(this.api, result.orderId);
        if (!fill.filled) {
          log.error({ orderId: result.orderId, fillStatus: fill.status }, 'Exit order not filled — activating kill switch');
          this.audit.error('live', 'EXIT_NOT_FILLED', JSON.stringify(fill), 'LIVE');
          this.notifier?.notifyError('live-engine', `매도 미체결: ${fill.status} — 킬스위치 발동`);
          this.stateMachine.transition('IN_POSITION');
          await this.killSwitch.activate('Exit order not filled', true);
          return;
        }

        const balance = await this.api.getBalance();
        const exitValue = balance.availableKrw;
        const pnl = exitValue - this.equity;
        const exitQty = this.positionQty;

        this.riskMgr.recordTrade(pnl);
        this.modeMgr.recordTrade(pnl, exitValue);
        this.equity = exitValue;
        this.positionQty = 0;
        this.positionEntryPrice = 0;
        this.positionEntryTime = 0;
        this.currentStopLoss = 0;

        this.stateMachine.transition('IDLE');

        this.pushEvent({
          ts: Date.now(),
          type: 'fill',
          summary: `청산 ${exitQty.toFixed(6)} BTC PnL ${pnl >= 0 ? '+' : ''}${pnl.toLocaleString()} KRW`,
          detail: `${reason} (Order ${result.orderId})`,
        });
        if ('notifyPositionClosed' in this.strategy) {
          (this.strategy as { notifyPositionClosed(): void }).notifyPositionClosed();
        }

        this.audit.info('live', 'EXIT_FILLED', JSON.stringify({
          orderId: result.orderId, pnl, reason,
        }), 'LIVE');

        log.info({ orderId: result.orderId, pnl, reason, equity: this.equity }, 'Live exit');
        this.notifier?.notifyExit(balance.availableKrw, exitQty, pnl, reason);
        this.notifyPositionUpdate();
      } else {
        // 매도 실패 → 재시도 or 킬스위치
        this.stateMachine.transition('IN_POSITION');
        this.audit.error('live', 'EXIT_FAILED', result.message, 'LIVE');
        log.error({ message: result.message }, 'Exit failed — activating kill switch');
        this.notifier?.notifyError('live-engine', `매도 실패: ${result.message} — 킬스위치 발동`);
        await this.killSwitch.activate('Exit order failed', true);
      }
    } catch (err) {
      this.stateMachine.transition('IN_POSITION');
      this.riskMgr.recordOrder(false);
      this.audit.error('live', 'EXIT_ERROR', String(err), 'LIVE');
      log.error({ err }, 'Exit error — activating kill switch');
      this.notifier?.notifyError('live-engine', `매도 에러: ${String(err)} — 킬스위치 발동`);
      await this.killSwitch.activate('Exit error', true);
    }
  }

  private calcSpreadBps(): number {
    if (!this.lastOrderBook || this.lastOrderBook.asks.length === 0 || this.lastOrderBook.bids.length === 0) {
      return config.risk.minSpreadBps;
    }
    const bestAsk = this.lastOrderBook.asks[0]!.price;
    const bestBid = this.lastOrderBook.bids[0]!.price;
    const mid = (bestAsk + bestBid) / 2;
    return mid > 0 ? ((bestAsk - bestBid) / mid) * 10000 : 0;
  }

  /**
   * 재시작 시 미체결/체결 상태 복구: GET /v1/orders → GET /v1/order로 상태 재구성
   * - wait/watch 주문이 있으면 상태머신을 ENTRY_PENDING 또는 EXIT_PENDING에 맞춤
   * - 포지션은 있는데 진입가가 없으면 done 매수 주문에서 평균체결가 복구
   */
  async reconcileOpenOrders(): Promise<void> {
    try {
      const waitOrders = await this.api.getOrders({ state: 'wait', limit: 20 });
      const watchOrders = await this.api.getOrders({ state: 'watch', limit: 20 });
      const pending = [...waitOrders, ...watchOrders];

      for (const o of pending) {
        const uuid = typeof o.uuid === 'string' ? o.uuid : (o as Record<string, unknown>)['uuid'] as string;
        const detail = await this.api.getOrder(uuid);
        if (!detail) continue;
        if (detail.side === 'bid' && this.stateMachine.current === 'IDLE') {
          try {
            this.stateMachine.transition('ENTRY_PENDING');
          } catch {
            // invalid transition ignore
          }
          break;
        }
        if (detail.side === 'ask' && this.stateMachine.isInPosition()) {
          try {
            this.stateMachine.transition('EXIT_PENDING');
          } catch {
            // invalid transition ignore
          }
          break;
        }
      }

      if (this.positionQty > 0 && this.positionEntryPrice <= 0) {
        const doneOrders = await this.api.getOrders({ state: 'done', limit: 30 });
        for (const o of doneOrders) {
          const side = String((o as Record<string, unknown>)['side'] ?? '').toLowerCase();
          if (side !== 'bid') continue;
          const uuid = typeof o.uuid === 'string' ? o.uuid : (o as Record<string, unknown>)['uuid'] as string;
          const detail = await this.api.getOrder(uuid);
          if (!detail || detail.filledQty <= 0 || detail.side !== 'bid') continue;
          const totalKrw = detail.price;
          this.positionEntryPrice = totalKrw / detail.filledQty;
          const execVol = Number((o as Record<string, unknown>)['executed_volume'] ?? detail.filledQty);
          const created = (o as Record<string, unknown>)['created_at'];
          if (typeof created === 'string') {
            this.positionEntryTime = new Date(created).getTime();
          }
          log.info({ orderId: uuid, positionEntryPrice: this.positionEntryPrice }, 'Reconciled entry price from done order');
          break;
        }
      }
    } catch (err) {
      log.warn({ err }, 'reconcileOpenOrders failed');
    }
  }

  async syncBalance(): Promise<void> {
    try {
      const balance = await this.api.getBalance();
      this.equity = balance.availableKrw;
      this.positionQty = balance.totalBtc;
      if (this.positionQty <= 0) {
        this.positionEntryPrice = 0;
        this.positionEntryTime = 0;
        this.currentStopLoss = 0;
      }
      log.info({ equity: this.equity, btc: this.positionQty }, 'Balance synced');
      this.notifyPositionUpdate();
    } catch (err) {
      log.error({ err }, 'Balance sync failed');
    }
  }

  hasPosition(): boolean {
    return this.positionQty > 0;
  }

  getEquity(): number {
    return this.equity;
  }
}
