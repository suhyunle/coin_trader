import type { Candle } from '../types/index.js';

/**
 * Donchian Channel
 */
export class DonchianChannel {
  private readonly period: number;
  private highs: number[] = [];
  private lows: number[] = [];
  private _upper: number = 0;
  private _lower: number = 0;
  private _middle: number = 0;
  private ready: boolean = false;

  constructor(period: number) {
    if (period < 1) throw new Error('Donchian period must be >= 1');
    this.period = period;
  }

  update(candle: Candle): { upper: number; lower: number; middle: number } {
    this.highs.push(candle.high);
    this.lows.push(candle.low);

    if (this.highs.length > this.period) {
      this.highs.shift();
      this.lows.shift();
    }

    if (this.highs.length === this.period) {
      this._upper = Math.max(...this.highs);
      this._lower = Math.min(...this.lows);
      this._middle = (this._upper + this._lower) / 2;
      this.ready = true;
    }

    return { upper: this._upper, lower: this._lower, middle: this._middle };
  }

  get upper(): number { return this._upper; }
  get lower(): number { return this._lower; }
  get middle(): number { return this._middle; }
  get isReady(): boolean { return this.ready; }

  reset(): void {
    this.highs = [];
    this.lows = [];
    this._upper = 0;
    this._lower = 0;
    this._middle = 0;
    this.ready = false;
  }
}
