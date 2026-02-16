import { createChildLogger } from '../logger.js';
import type { Tick, Candle } from '../types/index.js';

const log = createChildLogger('aggregator');

const FIVE_MINUTES_MS = 5 * 60 * 1000;

export type CandleHandler = (candle: Candle) => void;

/**
 * Tick → 5분봉 OHLCV 집계기
 *
 * 정책:
 * - 과거 tick(현재 윈도우 이전): 버림 + 로그
 * - 역순 tick(같은 윈도우 내): 허용 (volume 가산, high/low 갱신)
 * - 타임스탬프 기준으로 5분 경계에 봉 마감
 */
export class CandleAggregator {
  private current: MutableCandle | null = null;
  private onClose: CandleHandler;
  private tickCount = 0;
  private droppedCount = 0;

  constructor(onClose: CandleHandler) {
    this.onClose = onClose;
  }

  /**
   * 새 tick 수신
   */
  feed(tick: Tick): void {
    const windowStart = this.getWindowStart(tick.timestamp);

    // 현재 봉이 없으면 새 봉 시작
    if (!this.current) {
      this.current = this.newCandle(windowStart, tick);
      this.tickCount++;
      return;
    }

    // 이전 윈도우의 tick → 버림
    if (windowStart < this.current.timestamp) {
      this.droppedCount++;
      log.debug(
        { tickTs: tick.timestamp, candleTs: this.current.timestamp },
        'Dropped stale tick',
      );
      return;
    }

    // 새 윈도우 → 현재 봉 마감 + 새 봉 시작
    if (windowStart > this.current.timestamp) {
      this.closeCurrent();
      this.current = this.newCandle(windowStart, tick);
      this.tickCount++;
      return;
    }

    // 같은 윈도우 → 업데이트
    this.updateCandle(this.current, tick);
    this.tickCount++;
  }

  /**
   * 타이머 기반 강제 마감 (5분 경계 체크)
   */
  flushIfExpired(now: number): Candle | null {
    if (!this.current) return null;

    const windowEnd = this.current.timestamp + FIVE_MINUTES_MS;
    if (now >= windowEnd) {
      const candle = this.freezeCandle(this.current);
      this.onClose(candle);
      this.current = null;
      return candle;
    }
    return null;
  }

  /** 강제 마감 (shutdown 시) */
  flush(): Candle | null {
    if (!this.current) return null;
    const candle = this.freezeCandle(this.current);
    this.onClose(candle);
    this.current = null;
    return candle;
  }

  getStats(): { tickCount: number; droppedCount: number } {
    return { tickCount: this.tickCount, droppedCount: this.droppedCount };
  }

  private closeCurrent(): void {
    if (this.current) {
      this.onClose(this.freezeCandle(this.current));
    }
  }

  private getWindowStart(ts: number): number {
    return Math.floor(ts / FIVE_MINUTES_MS) * FIVE_MINUTES_MS;
  }

  private newCandle(timestamp: number, tick: Tick): MutableCandle {
    return {
      timestamp,
      open: tick.price,
      high: tick.price,
      low: tick.price,
      close: tick.price,
      volume: tick.volume,
    };
  }

  private updateCandle(candle: MutableCandle, tick: Tick): void {
    if (tick.price > candle.high) candle.high = tick.price;
    if (tick.price < candle.low) candle.low = tick.price;
    candle.close = tick.price;
    candle.volume += tick.volume;
  }

  private freezeCandle(c: MutableCandle): Candle {
    return {
      timestamp: c.timestamp,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
      volume: c.volume,
    };
  }
}

interface MutableCandle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}
