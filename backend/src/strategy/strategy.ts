import type { Candle, StrategySignal } from '../types/index.js';

export interface StrategyParams {
  readonly [key: string]: number | undefined;
}

export interface Strategy {
  readonly name: string;
  readonly params: StrategyParams;
  onCandle(candle: Candle): StrategySignal;
  reset(): void;
}
