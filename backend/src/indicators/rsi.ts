import type { Candle } from '../types/index.js';

/**
 * RSI (Relative Strength Index) — Wilder smoothing
 * RSI = 100 - 100/(1 + RS), RS = avgGain / avgLoss
 */
export class RSI {
  private readonly period: number;
  private prevClose: number | null = null;
  private avgGain: number = 0;
  private avgLoss: number = 0;
  private ready: boolean = false;
  private count: number = 0;

  constructor(period: number) {
    if (period < 1) throw new Error('RSI period must be >= 1');
    this.period = period;
  }

  update(candle: Candle): number {
    if (this.prevClose === null) {
      this.prevClose = candle.close;
      return 50; // neutral until we have first change
    }

    const change = candle.close - this.prevClose;
    this.prevClose = candle.close;

    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? -change : 0;

    if (!this.ready) {
      this.count++;
      this.avgGain = (this.avgGain * (this.count - 1) + gain) / this.count;
      this.avgLoss = (this.avgLoss * (this.count - 1) + loss) / this.count;
      if (this.count >= this.period) {
        this.ready = true;
      }
    } else {
      this.avgGain = (this.avgGain * (this.period - 1) + gain) / this.period;
      this.avgLoss = (this.avgLoss * (this.period - 1) + loss) / this.period;
    }

    return this.value;
  }

  get value(): number {
    if (!this.ready || this.avgLoss === 0) return 50;
    const rs = this.avgGain / this.avgLoss;
    return 100 - 100 / (1 + rs);
  }

  get isReady(): boolean {
    return this.ready;
  }

  reset(): void {
    this.prevClose = null;
    this.avgGain = 0;
    this.avgLoss = 0;
    this.ready = false;
    this.count = 0;
  }
}
