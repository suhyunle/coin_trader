import { describe, it, expect } from 'vitest';
import { calcPositionSize } from '../src/risk/position-sizer.js';

describe('calcPositionSize', () => {
  it('should size based on ATR risk', () => {
    const sizing = calcPositionSize(
      10_000_000,    // equity 1000만원
      50_000_000,    // entry 5천만원
      1_000_000,     // ATR 100만원
      2.0,           // multiplier
    );

    // riskKrw = 10M * 0.01 = 100K
    // stopDistance = 1M * 2 = 2M
    // qty = 100K / 2M = 0.05 BTC
    // krwAmount = 0.05 * 50M = 2.5M → capped at maxPositionKrw (500K)
    expect(sizing.stopLoss).toBe(48_000_000); // 50M - 2M
    expect(sizing.riskKrw).toBe(100_000);
    // Capped to maxPositionKrw
    expect(sizing.krwAmount).toBeLessThanOrEqual(500_000);
  });

  it('should not exceed equity', () => {
    const sizing = calcPositionSize(
      100_000,       // tiny equity
      50_000_000,
      1_000_000,
      2.0,
    );
    expect(sizing.krwAmount).toBeLessThanOrEqual(100_000 * 0.95);
  });

  it('should handle zero ATR gracefully', () => {
    const sizing = calcPositionSize(10_000_000, 50_000_000, 0, 2.0);
    expect(sizing.qty).toBe(0);
  });
});
