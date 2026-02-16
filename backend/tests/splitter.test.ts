import { describe, it, expect } from 'vitest';
import { trainTestSplit, walkForwardSplit } from '../src/data/splitter.js';
import type { Candle } from '../src/types/index.js';

function makeCandles(n: number): Candle[] {
  return Array.from({ length: n }, (_, i) => ({
    timestamp: i * 300000,
    open: 100, high: 110, low: 90, close: 100, volume: 1,
  }));
}

describe('trainTestSplit', () => {
  it('should split at ratio', () => {
    const candles = makeCandles(100);
    const { train, test } = trainTestSplit(candles, 0.7);
    expect(train).toHaveLength(70);
    expect(test).toHaveLength(30);
  });
});

describe('walkForwardSplit', () => {
  it('should create correct windows', () => {
    const candles = makeCandles(100);
    const windows = walkForwardSplit(candles, 50, 20);
    // Window 0: train[0..50), test[50..70)
    // Window 1: train[20..70), test[70..90)
    // Window 2: train[40..90) → 40+50+20=110 > 100, not enough
    expect(windows).toHaveLength(2);
    expect(windows[0]!.train).toHaveLength(50);
    expect(windows[0]!.test).toHaveLength(20);
    expect(windows[1]!.windowIndex).toBe(1);
  });

  it('should handle custom step', () => {
    const candles = makeCandles(100);
    const windows = walkForwardSplit(candles, 50, 20, 10);
    // step=10: start=0,10,20,30
    // 0: train[0..50) test[50..70) ✓
    // 10: train[10..60) test[60..80) ✓
    // 20: train[20..70) test[70..90) ✓
    // 30: train[30..80) test[80..100) ✓
    // 40: 40+50+20=110 > 100 ✗
    expect(windows).toHaveLength(4);
  });
});
