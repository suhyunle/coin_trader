/**
 * Exponential Moving Average
 */
export class EMA {
  private readonly period: number;
  private readonly multiplier: number;
  private current: number = 0;
  private count: number = 0;
  private sum: number = 0;
  private ready: boolean = false;

  constructor(period: number) {
    if (period < 1) throw new Error('EMA period must be >= 1');
    this.period = period;
    this.multiplier = 2 / (period + 1);
  }

  update(value: number): number {
    if (!this.ready) {
      this.sum += value;
      this.count++;
      if (this.count === this.period) {
        this.current = this.sum / this.period;
        this.ready = true;
      } else {
        this.current = this.sum / this.count;
      }
    } else {
      this.current = (value - this.current) * this.multiplier + this.current;
    }
    return this.current;
  }

  get value(): number { return this.current; }
  get isReady(): boolean { return this.ready; }

  reset(): void {
    this.current = 0;
    this.count = 0;
    this.sum = 0;
    this.ready = false;
  }
}
