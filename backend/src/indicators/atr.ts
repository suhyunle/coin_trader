import type { Candle } from '../types/index.js';

/**
 * ATR (Average True Range) with Wilder smoothing
 */
export class ATR {
  private readonly period: number;
  private prevClose: number | null = null;
  private values: number[] = [];
  private current: number = 0;
  private ready: boolean = false;

  constructor(period: number) {
    if (period < 1) throw new Error('ATR period must be >= 1');
    this.period = period;
  }

  update(candle: Candle): number {
    const tr = this.trueRange(candle);
    this.prevClose = candle.close;

    if (!this.ready) {
      this.values.push(tr);
      if (this.values.length === this.period) {
        this.current = this.values.reduce((a, b) => a + b, 0) / this.period;
        this.ready = true;
      }
    } else {
      // Wilder smoothing: ATR = ((period-1) * prevATR + TR) / period
      this.current = (this.current * (this.period - 1) + tr) / this.period;
    }

    return this.current;
  }

  get value(): number {
    return this.current;
  }

  get isReady(): boolean {
    return this.ready;
  }

  private trueRange(candle: Candle): number {
    if (this.prevClose === null) {
      return candle.high - candle.low;
    }
    return Math.max(
      candle.high - candle.low,
      Math.abs(candle.high - this.prevClose),
      Math.abs(candle.low - this.prevClose),
    );
  }

  reset(): void {
    this.prevClose = null;
    this.values = [];
    this.current = 0;
    this.ready = false;
  }
}
