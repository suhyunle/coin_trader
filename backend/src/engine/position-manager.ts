import type { Candle, Position, Fill } from '../types/index.js';
import type { EventBus } from './event-bus.js';

export interface PositionManagerConfig {
  readonly trailingStopAtrMultiplier: number;  // 트레일링 스톱 ATR 배수
}

/**
 * 1포지션 룰 + SL/트레일링 스톱 관리
 * 롱전용: 매수 진입, 매도 청산만 허용
 */
export class PositionManager {
  private position: Position | null = null;
  private readonly bus: EventBus;
  private readonly config: PositionManagerConfig;

  constructor(bus: EventBus, config: PositionManagerConfig) {
    this.bus = bus;
    this.config = config;
  }

  get hasPosition(): boolean {
    return this.position !== null;
  }

  get current(): Position | null {
    return this.position ? { ...this.position } : null;
  }

  openPosition(fill: Fill, stopLoss: number, atr: number): void {
    if (this.position) {
      throw new Error('Already in position — 1 position rule violated');
    }

    const trailingStop = fill.price - atr * this.config.trailingStopAtrMultiplier;

    this.position = {
      entryPrice: fill.price,
      qty: fill.qty,
      entryTime: fill.timestamp,
      stopLoss,
      trailingStop: Math.max(stopLoss, trailingStop),
      highWaterMark: fill.price,
    };

    this.bus.emit({
      type: 'POSITION_OPENED',
      timestamp: fill.timestamp,
      position: { ...this.position },
    });
  }

  closePosition(fill: Fill): { pnl: number; pnlPct: number } {
    if (!this.position) {
      throw new Error('No position to close');
    }

    const pnl = (fill.price - this.position.entryPrice) * this.position.qty - fill.fee;
    const pnlPct = ((fill.price - this.position.entryPrice) / this.position.entryPrice) * 100;

    this.bus.emit({
      type: 'POSITION_CLOSED',
      timestamp: fill.timestamp,
      entryPrice: this.position.entryPrice,
      exitPrice: fill.price,
      qty: this.position.qty,
      pnl,
      pnlPct,
    });

    this.position = null;
    return { pnl, pnlPct };
  }

  /**
   * 봉마다 호출: 트레일링 스톱 업데이트, SL 히트 확인
   * @returns SL/트레일링 히트 시 스톱 가격, 아니면 null
   */
  updateStops(candle: Candle, currentAtr: number): number | null {
    if (!this.position) return null;

    // 고점 갱신
    if (candle.high > this.position.highWaterMark) {
      this.position.highWaterMark = candle.high;
      const newTrailing = candle.high - currentAtr * this.config.trailingStopAtrMultiplier;
      if (newTrailing > this.position.trailingStop) {
        this.position.trailingStop = newTrailing;

        this.bus.emit({
          type: 'STOP_UPDATED',
          timestamp: candle.timestamp,
          stopLoss: this.position.stopLoss,
          trailingStop: this.position.trailingStop,
        });
      }
    }

    // 유효 스톱 = max(초기SL, 트레일링)
    const effectiveStop = Math.max(this.position.stopLoss, this.position.trailingStop);

    // 봉 저점이 스톱 이하 → 스톱 히트
    if (candle.low <= effectiveStop) {
      return effectiveStop;
    }

    return null;
  }

  reset(): void {
    this.position = null;
  }
}
