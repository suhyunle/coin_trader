import type { Candle, Order, Fill, BacktestReport, EquityPoint } from '../types/index.js';
import type { Strategy } from '../strategy/strategy.js';
import { EventBus } from './event-bus.js';
import { FillModel, type FillModelConfig } from './fill-model.js';
import { PositionManager, type PositionManagerConfig } from './position-manager.js';
import { ATR } from '../indicators/atr.js';
import { buildReport } from '../report/metrics.js';
import { buildTradeLog } from '../report/trade-log.js';

export interface BacktestConfig {
  readonly initialCapital: number;        // KRW
  readonly positionSizePct: number;       // 자본 대비 포지션 크기 (0~1)
  readonly fillModel?: Partial<FillModelConfig>;
  readonly positionManager: PositionManagerConfig;
  readonly atrPeriod?: number;            // 스톱용 ATR 기간
}

const DEFAULT_CONFIG: BacktestConfig = {
  initialCapital: 10_000_000,
  positionSizePct: 1.0,
  positionManager: { trailingStopAtrMultiplier: 3.0 },
  atrPeriod: 14,
};

export class BacktestEngine {
  private readonly config: BacktestConfig;
  private bus: EventBus;
  private fillModel: FillModel;
  private posMgr: PositionManager;
  private atr: ATR;

  private equity: number;
  private equityCurve: EquityPoint[] = [];
  private pendingOrders: Order[] = [];
  private orderIdCounter: number = 0;
  private barIndex: number = 0;

  constructor(config?: Partial<BacktestConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.bus = new EventBus();
    this.fillModel = new FillModel(this.config.fillModel);
    this.posMgr = new PositionManager(this.bus, this.config.positionManager);
    this.atr = new ATR(this.config.atrPeriod ?? 14);
    this.equity = this.config.initialCapital;
  }

  run(candles: Candle[], strategy: Strategy): BacktestReport {
    this.reset(strategy);

    for (const candle of candles) {
      this.processCandle(candle, strategy);
      this.barIndex++;
    }

    // 미청산 포지션 마지막 봉 close로 강제 청산
    if (this.posMgr.hasPosition && candles.length > 0) {
      const lastCandle = candles[candles.length - 1]!;
      this.forceClose(lastCandle, strategy);
    }

    const trades = buildTradeLog(this.bus.getLog(), this.barIndex);
    return buildReport(
      trades,
      this.equityCurve,
      this.config.initialCapital,
      this.equity,
    );
  }

  private processCandle(candle: Candle, strategy: Strategy): void {
    this.bus.emit({ type: 'CANDLE', timestamp: candle.timestamp, candle });
    this.atr.update(candle);

    // 1. 대기 주문 체결 시도
    this.processPendingOrders(candle, strategy);

    // 2. 스톱 확인
    if (this.posMgr.hasPosition && this.atr.isReady) {
      const stopHit = this.posMgr.updateStops(candle, this.atr.value);
      if (stopHit !== null) {
        this.executeStopClose(candle, stopHit, strategy);
      }
    }

    // 3. 전략 시그널
    if (this.posMgr.hasPosition || !this.hasOpenBuyOrder()) {
      const signal = strategy.onCandle(candle);
      this.bus.emit({ type: 'SIGNAL', timestamp: candle.timestamp, signal });

      if (signal.action === 'LONG_ENTRY' && !this.posMgr.hasPosition) {
        const size = this.equity * this.config.positionSizePct;
        this.createOrder('BUY', 'MARKET', 0, size, candle.timestamp, signal.stopLoss);
      } else if (signal.action === 'LONG_EXIT' && this.posMgr.hasPosition) {
        const pos = this.posMgr.current!;
        this.createOrder('SELL', 'MARKET', 0, pos.qty, candle.timestamp);
      }
    }

    // 에쿼티 기록
    const unrealized = this.getUnrealizedPnl(candle);
    this.equityCurve.push({
      timestamp: candle.timestamp,
      equity: this.equity + unrealized,
    });
  }

  private processPendingOrders(candle: Candle, strategy: Strategy): void {
    const remaining: Order[] = [];

    for (const order of this.pendingOrders) {
      const fill = this.fillModel.tryFill(order, candle);
      if (fill) {
        order.status = 'FILLED';
        this.bus.emit({ type: 'ORDER_FILLED', timestamp: candle.timestamp, fill });

        if (fill.side === 'BUY') {
          const stopLoss = (order as OrderWithMeta).stopLoss ?? 0;
          this.posMgr.openPosition(fill, stopLoss, this.atr.isReady ? this.atr.value : 0);
          this.equity -= fill.qty * fill.price + fill.fee;
        } else {
          const result = this.posMgr.closePosition(fill);
          this.equity += fill.qty * fill.price - fill.fee;
          if ('notifyPositionClosed' in strategy) {
            (strategy as { notifyPositionClosed(): void }).notifyPositionClosed();
          }
          void result;
        }
      } else {
        remaining.push(order);
      }
    }

    this.pendingOrders = remaining;
  }

  private executeStopClose(candle: Candle, stopPrice: number, strategy: Strategy): void {
    const pos = this.posMgr.current!;
    // 스톱 가격으로 직접 체결 생성
    const fill: Fill = {
      orderId: `stop-${this.orderIdCounter++}`,
      side: 'SELL',
      price: stopPrice,
      qty: pos.qty,
      fee: pos.qty * stopPrice * (this.config.fillModel?.feeRate ?? 0.0005),
      timestamp: candle.timestamp,
    };

    this.bus.emit({ type: 'ORDER_FILLED', timestamp: candle.timestamp, fill });
    this.posMgr.closePosition(fill);
    this.equity += fill.qty * fill.price - fill.fee;

    // 대기 매도 주문 취소
    this.pendingOrders = this.pendingOrders.filter((o) => {
      if (o.side === 'SELL') {
        o.status = 'CANCELLED';
        this.bus.emit({ type: 'ORDER_CANCELLED', timestamp: candle.timestamp, orderId: o.id });
        return false;
      }
      return true;
    });

    if ('notifyPositionClosed' in strategy) {
      (strategy as { notifyPositionClosed(): void }).notifyPositionClosed();
    }
  }

  private forceClose(candle: Candle, strategy: Strategy): void {
    const pos = this.posMgr.current!;
    const fill: Fill = {
      orderId: `force-close-${this.orderIdCounter++}`,
      side: 'SELL',
      price: candle.close,
      qty: pos.qty,
      fee: pos.qty * candle.close * (this.config.fillModel?.feeRate ?? 0.0005),
      timestamp: candle.timestamp,
    };
    this.bus.emit({ type: 'ORDER_FILLED', timestamp: candle.timestamp, fill });
    this.posMgr.closePosition(fill);
    this.equity += fill.qty * fill.price - fill.fee;

    if ('notifyPositionClosed' in strategy) {
      (strategy as { notifyPositionClosed(): void }).notifyPositionClosed();
    }
  }

  private createOrder(
    side: 'BUY' | 'SELL',
    type: 'MARKET' | 'LIMIT' | 'STOP',
    price: number,
    qty: number,
    timestamp: number,
    stopLoss?: number,
  ): void {
    const order: OrderWithMeta = {
      id: `ord-${this.orderIdCounter++}`,
      side,
      type,
      price,
      qty,
      createdAt: timestamp,
      status: 'PENDING',
      stopLoss,
    };

    this.pendingOrders.push(order);
    this.bus.emit({ type: 'ORDER_CREATED', timestamp, order });
  }

  private hasOpenBuyOrder(): boolean {
    return this.pendingOrders.some((o) => o.side === 'BUY' && o.status === 'PENDING');
  }

  private getUnrealizedPnl(candle: Candle): number {
    const pos = this.posMgr.current;
    if (!pos) return 0;
    return (candle.close - pos.entryPrice) * pos.qty;
  }

  private reset(strategy: Strategy): void {
    this.bus.reset();
    this.posMgr.reset();
    this.atr.reset();
    strategy.reset();
    this.equity = this.config.initialCapital;
    this.equityCurve = [];
    this.pendingOrders = [];
    this.orderIdCounter = 0;
    this.barIndex = 0;
  }

  getEventLog() {
    return this.bus.getLog();
  }
}

interface OrderWithMeta extends Order {
  stopLoss?: number;
}
