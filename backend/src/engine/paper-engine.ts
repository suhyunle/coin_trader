import { createChildLogger } from '../logger.js';
import { config } from '../config.js';
import type { Candle, OrderBook } from '../types/index.js';
import { EventBus } from './event-bus.js';
import { PositionManager } from './position-manager.js';
import { ATR } from '../indicators/atr.js';
import { TradingStateMachine } from '../risk/state-machine.js';
import { RiskManager } from '../risk/risk-manager.js';
import { calcPositionSize } from '../risk/position-sizer.js';
import { AuditLog } from '../safety/audit-log.js';
import { ModeManager } from '../mode/mode-manager.js';
import type { Strategy } from '../strategy/strategy.js';

const log = createChildLogger('paper-engine');

/** AUTO ON일 때만 가상 주문 실행 (실전과 동일한 제어) */
export type GetAuto = () => boolean;

/**
 * 페이퍼 트레이딩 엔진
 * 실시간 캔들을 받아 가상 주문 실행
 * 백테스트 전략 인터페이스 동일 사용
 * AUTO=ON일 때만 진입/청산 신호로 주문 생성
 */
export class PaperEngine {
  private readonly bus: EventBus;
  private readonly posMgr: PositionManager;
  private readonly atr: ATR;
  private readonly stateMachine: TradingStateMachine;
  private readonly riskMgr: RiskManager;
  private readonly audit: AuditLog;
  private readonly modeMgr: ModeManager;
  private readonly strategy: Strategy;
  private readonly getAuto: GetAuto;

  private equity: number;
  private lastOrderBook: OrderBook | null = null;

  constructor(
    strategy: Strategy,
    stateMachine: TradingStateMachine,
    riskMgr: RiskManager,
    audit: AuditLog,
    modeMgr: ModeManager,
    getAuto: GetAuto,
  ) {
    this.strategy = strategy;
    this.stateMachine = stateMachine;
    this.riskMgr = riskMgr;
    this.audit = audit;
    this.modeMgr = modeMgr;
    this.getAuto = getAuto;

    this.bus = new EventBus();
    this.posMgr = new PositionManager(this.bus, {
      trailingStopAtrMultiplier: config.strategy.trailingStopAtrMultiplier,
    });
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
    log.debug({ count: candles.length }, 'Paper engine warmed up');
  }

  /**
   * 새 캔들 수신 시 호출
   */
  onCandle(candle: Candle): void {
    if (!this.stateMachine.isActive()) return;

    this.bus.emit({ type: 'CANDLE', timestamp: candle.timestamp, candle });
    this.atr.update(candle);

    // 스톱 체크
    if (this.posMgr.hasPosition && this.atr.isReady) {
      const stopHit = this.posMgr.updateStops(candle, this.atr.value);
      if (stopHit !== null) {
        this.executeStop(candle, stopHit);
        return;
      }
    }

    // 전략 시그널
    const signal = this.strategy.onCandle(candle);
    this.bus.emit({ type: 'SIGNAL', timestamp: candle.timestamp, signal });

    if (!this.getAuto()) return;

    if (signal.action === 'LONG_ENTRY' && this.stateMachine.isIdle()) {
      this.tryEntry(candle);
    } else if (signal.action === 'LONG_EXIT' && this.stateMachine.isInPosition()) {
      this.tryExit(candle);
    }
  }

  onOrderBook(ob: OrderBook): void {
    this.lastOrderBook = ob;
  }

  private tryEntry(candle: Candle): void {
    if (!this.atr.isReady) return;

    // 스프레드 계산
    const spread = this.calcSpreadBps();

    // 리스크 체크
    const check = this.riskMgr.checkEntry({
      spread,
      atr: this.atr.value,
      equity: this.equity,
    });
    if (!check.allowed) {
      log.info({ reason: check.reason }, 'Entry blocked');
      return;
    }

    // 포지션 사이징
    const sizing = calcPositionSize(this.equity, candle.close, this.atr.value);
    if (sizing.qty <= 0 || sizing.krwAmount <= 0) return;

    // 가상 체결 — 호가 있으면 매수=best ask 기준, 없으면 종가+슬리피지
    this.stateMachine.transition('ENTRY_PENDING');
    const fillPrice = this.resolveFillPrice('BUY', candle.close);
    const fee = sizing.qty * fillPrice * config.execution.feeRate;

    const fill = {
      orderId: `paper-buy-${Date.now()}`,
      side: 'BUY' as const,
      price: fillPrice,
      qty: sizing.qty,
      fee,
      timestamp: candle.timestamp,
    };

    this.bus.emit({ type: 'ORDER_FILLED', timestamp: candle.timestamp, fill });
    this.posMgr.openPosition(fill, sizing.stopLoss, this.atr.value);
    this.equity -= sizing.krwAmount + fee;
    this.stateMachine.transition('IN_POSITION');

    this.audit.info('paper', 'ENTRY', JSON.stringify({
      price: fillPrice, qty: sizing.qty, sl: sizing.stopLoss,
    }), 'PAPER');

    log.info({
      price: fillPrice,
      qty: sizing.qty,
      sl: sizing.stopLoss,
      equity: this.equity,
    }, 'Paper entry');
  }

  private tryExit(candle: Candle): void {
    const pos = this.posMgr.current;
    if (!pos) return;

    this.stateMachine.transition('EXIT_PENDING');
    const fillPrice = this.resolveFillPrice('SELL', candle.close);
    const fee = pos.qty * fillPrice * config.execution.feeRate;

    const fill = {
      orderId: `paper-sell-${Date.now()}`,
      side: 'SELL' as const,
      price: fillPrice,
      qty: pos.qty,
      fee,
      timestamp: candle.timestamp,
    };

    this.bus.emit({ type: 'ORDER_FILLED', timestamp: candle.timestamp, fill });
    const result = this.posMgr.closePosition(fill);
    this.equity += pos.qty * fillPrice - fee;
    this.riskMgr.recordTrade(result.pnl);
    this.modeMgr.recordTrade(result.pnl, this.equity);
    this.stateMachine.transition('IDLE');

    if ('notifyPositionClosed' in this.strategy) {
      (this.strategy as { notifyPositionClosed(): void }).notifyPositionClosed();
    }

    this.audit.info('paper', 'EXIT', JSON.stringify({
      price: fillPrice, pnl: result.pnl, pnlPct: result.pnlPct,
    }), 'PAPER');

    log.info({ price: fillPrice, pnl: result.pnl, equity: this.equity }, 'Paper exit');
  }

  private executeStop(candle: Candle, stopPrice: number): void {
    const pos = this.posMgr.current;
    if (!pos) return;

    const fee = pos.qty * stopPrice * config.execution.feeRate;
    const fill = {
      orderId: `paper-stop-${Date.now()}`,
      side: 'SELL' as const,
      price: stopPrice,
      qty: pos.qty,
      fee,
      timestamp: candle.timestamp,
    };

    this.bus.emit({ type: 'ORDER_FILLED', timestamp: candle.timestamp, fill });
    const result = this.posMgr.closePosition(fill);
    this.equity += pos.qty * stopPrice - fee;
    this.riskMgr.recordTrade(result.pnl);
    this.modeMgr.recordTrade(result.pnl, this.equity);

    if (this.stateMachine.canTransition('COOLDOWN')) {
      this.stateMachine.transition('COOLDOWN');
    } else {
      this.stateMachine.transition('IDLE');
    }

    if ('notifyPositionClosed' in this.strategy) {
      (this.strategy as { notifyPositionClosed(): void }).notifyPositionClosed();
    }

    this.audit.info('paper', 'STOP_HIT', JSON.stringify({
      stopPrice, pnl: result.pnl,
    }), 'PAPER');

    log.info({ stopPrice, pnl: result.pnl, equity: this.equity }, 'Paper stop hit');
  }

  /** 호가 있으면 매수=best ask, 매도=best bid 기준; 없으면 종가 ± 슬리피지 */
  private resolveFillPrice(side: 'BUY' | 'SELL', candleClose: number): number {
    const slippage = candleClose * (config.execution.slippageBps / 10000);
    if (this.lastOrderBook && this.lastOrderBook.asks.length > 0 && this.lastOrderBook.bids.length > 0) {
      const bestAsk = this.lastOrderBook.asks[0]!.price;
      const bestBid = this.lastOrderBook.bids[0]!.price;
      if (side === 'BUY') return bestAsk + slippage;
      return bestBid - slippage;
    }
    if (side === 'BUY') return candleClose + slippage;
    return candleClose - slippage;
  }

  private calcSpreadBps(): number {
    if (!this.lastOrderBook || this.lastOrderBook.asks.length === 0 || this.lastOrderBook.bids.length === 0) {
      return config.risk.minSpreadBps; // 기본값
    }
    const bestAsk = this.lastOrderBook.asks[0]!.price;
    const bestBid = this.lastOrderBook.bids[0]!.price;
    const mid = (bestAsk + bestBid) / 2;
    return mid > 0 ? ((bestAsk - bestBid) / mid) * 10000 : 0;
  }

  getEquity(): number {
    return this.equity;
  }

  getEventLog() {
    return this.bus.getLog();
  }

  /** 대시보드/API용 현재 포지션 (없으면 null) */
  getPosition(): { entryPrice: number; qty: number; entryTime: number; stopLoss: number; trailingStop: number } | null {
    const pos = this.posMgr.current;
    return pos ? { ...pos } : null;
  }
}
