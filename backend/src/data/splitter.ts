import type { Candle } from '../types/index.js';

export interface Split {
  readonly train: Candle[];
  readonly test: Candle[];
}

export interface WalkForwardWindow {
  readonly windowIndex: number;
  readonly train: Candle[];
  readonly test: Candle[];
}

/**
 * 단순 train/test 분할 (비율 기준)
 */
export function trainTestSplit(
  candles: Candle[],
  trainRatio: number = 0.7,
): Split {
  if (trainRatio <= 0 || trainRatio >= 1) {
    throw new Error('trainRatio must be between 0 and 1 (exclusive)');
  }
  const splitIdx = Math.floor(candles.length * trainRatio);
  return {
    train: candles.slice(0, splitIdx),
    test: candles.slice(splitIdx),
  };
}

/**
 * 워크포워드 분할
 * @param trainBars - 학습 기간 봉 수
 * @param testBars  - 테스트 기간 봉 수
 * @param stepBars  - 윈도우 이동 간격 (default = testBars)
 */
export function walkForwardSplit(
  candles: Candle[],
  trainBars: number,
  testBars: number,
  stepBars?: number,
): WalkForwardWindow[] {
  const step = stepBars ?? testBars;
  const windows: WalkForwardWindow[] = [];
  let start = 0;
  let idx = 0;

  while (start + trainBars + testBars <= candles.length) {
    windows.push({
      windowIndex: idx++,
      train: candles.slice(start, start + trainBars),
      test: candles.slice(start + trainBars, start + trainBars + testBars),
    });
    start += step;
  }

  return windows;
}
