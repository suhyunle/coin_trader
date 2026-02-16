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
import type { BithumbPublicRest } from '../market/rest-client.js';

const log = createChildLogger('live-engine');

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

  private equity: number;
  private positionQty: number = 0;
  private positionEntryPrice: number = 0;
  private currentStopLoss: number = 0;
  private lastOrderBook: OrderBook | null = null;

  constructor(
    strategy: Strategy,
    stateMachine: TradingStateMachine,
    riskMgr: RiskManager,
    api: BithumbPrivateApi,
    audit: AuditLog,
    killSwitch: KillSwitch,
    modeMgr: ModeManager,
    restClient?: BithumbPublicRest | null,
  ) {
    this.strategy = strategy;
    this.stateMachine = stateMachine;
    this.riskMgr = riskMgr;
    this.api = api;
    this.audit = audit;
    this.killSwitch = killSwitch;
    this.modeMgr = modeMgr;
    this.restClient = restClient ?? null;
    this.atr = new ATR(config.strategy.atrPeriod);
    this.equity = config.capital.initialKrw;
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
    this.audit.info('live', 'ENTRY_ATTEMPT', JSON.stringify({
      price: candle.close, krw: orderKrw, sl: sizing.stopLoss,
    }), 'LIVE');

    try {
      const result = await this.api.marketBuy(orderKrw);
      this.riskMgr.recordOrder(result.status === 'success');
      this.modeMgr.recordOrder(result.status === 'success');

      if (result.status === 'success') {
        // 잔고 확인으로 실제 체결 수량 확인
        const balance = await this.api.getBalance();
        this.positionQty = balance.totalBtc;
        this.positionEntryPrice = candle.close;
        this.currentStopLoss = sizing.stopLoss;
        this.equity = balance.availableKrw;
        this.stateMachine.transition('IN_POSITION');

        this.audit.info('live', 'ENTRY_FILLED', JSON.stringify({
          orderId: result.orderId, qty: this.positionQty,
        }), 'LIVE');

        log.info({
          orderId: result.orderId,
          qty: this.positionQty,
          sl: this.currentStopLoss,
        }, 'Live entry');
      } else {
        this.stateMachine.transition('IDLE');
        this.audit.warn('live', 'ENTRY_FAILED', result.message, 'LIVE');
        log.warn({ message: result.message }, 'Entry failed');
      }
    } catch (err) {
      this.stateMachine.transition('IDLE');
      this.riskMgr.recordOrder(false);
      this.modeMgr.recordOrder(false);
      this.audit.error('live', 'ENTRY_ERROR', String(err), 'LIVE');
      log.error({ err }, 'Entry error');

      // 연속 에러 시 킬스위치
      if (this.riskMgr.getOrderFailRate() > 50) {
        await this.killSwitch.activate('High order failure rate');
      }
    }
  }

  private async executeExit(reason: string): Promise<void> {
    if (this.positionQty <= 0) return;

    this.stateMachine.transition('EXIT_PENDING');
    this.audit.info('live', 'EXIT_ATTEMPT', JSON.stringify({
      reason, qty: this.positionQty,
    }), 'LIVE');

    try {
      const result = await this.api.marketSell(this.positionQty);
      this.riskMgr.recordOrder(result.status === 'success');
      this.modeMgr.recordOrder(result.status === 'success');

      if (result.status === 'success') {
        const balance = await this.api.getBalance();
        const exitValue = balance.availableKrw;
        const pnl = exitValue - this.equity;

        this.riskMgr.recordTrade(pnl);
        this.modeMgr.recordTrade(pnl, exitValue);
        this.equity = exitValue;
        this.positionQty = 0;
        this.positionEntryPrice = 0;
        this.currentStopLoss = 0;

        this.stateMachine.transition('IDLE');

        if ('notifyPositionClosed' in this.strategy) {
          (this.strategy as { notifyPositionClosed(): void }).notifyPositionClosed();
        }

        this.audit.info('live', 'EXIT_FILLED', JSON.stringify({
          orderId: result.orderId, pnl, reason,
        }), 'LIVE');

        log.info({ orderId: result.orderId, pnl, reason, equity: this.equity }, 'Live exit');
      } else {
        // 매도 실패 → 재시도 or 킬스위치
        this.stateMachine.transition('IN_POSITION');
        this.audit.error('live', 'EXIT_FAILED', result.message, 'LIVE');
        log.error({ message: result.message }, 'Exit failed — activating kill switch');
        await this.killSwitch.activate('Exit order failed', true);
      }
    } catch (err) {
      this.stateMachine.transition('IN_POSITION');
      this.riskMgr.recordOrder(false);
      this.audit.error('live', 'EXIT_ERROR', String(err), 'LIVE');
      log.error({ err }, 'Exit error — activating kill switch');
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

  async syncBalance(): Promise<void> {
    try {
      const balance = await this.api.getBalance();
      this.equity = balance.availableKrw;
      this.positionQty = balance.totalBtc;
      log.info({ equity: this.equity, btc: this.positionQty }, 'Balance synced');
    } catch (err) {
      log.error({ err }, 'Balance sync failed');
    }
  }

  getEquity(): number {
    return this.equity;
  }
}
