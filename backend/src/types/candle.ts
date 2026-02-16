export interface Candle {
  readonly timestamp: number;   // Unix ms
  readonly open: number;
  readonly high: number;
  readonly low: number;
  readonly close: number;
  readonly volume: number;
}
