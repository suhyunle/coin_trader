import { describe, it, expect } from 'vitest';
import { BacktestEngine } from '../src/engine/backtest-engine.js';
import { DonchianBreakout } from '../src/strategy/donchian-breakout.js';
import type { Candle } from '../src/types/index.js';

/**
 * 합성 데이터: 50봉 상승 → 50봉 하락
 * 상승 구간에서 진입, 하락 구간에서 청산 기대
 */
function generateSyntheticCandles(count: number): Candle[] {
  const candles: Candle[] = [];
  const half = Math.floor(count / 2);
  let price = 50_000_000; // 5천만 KRW

  for (let i = 0; i < count; i++) {
    const trend = i < half ? 500_000 : -500_000;
    const noise = (Math.sin(i * 0.5) * 100_000);
    price += trend + noise;
    const high = price + 200_000;
    const low = price - 200_000;
    candles.push({
      timestamp: 1700000000000 + i * 300_000,
      open: price - trend / 2,
      high,
      low,
      close: price,
      volume: 100,
    });
  }

  return candles;
}

describe('BacktestEngine', () => {
  it('should run without errors on synthetic data', () => {
    const candles = generateSyntheticCandles(100);
    const strategy = new DonchianBreakout({
      donchianPeriod: 10,
      atrPeriod: 5,
      atrStopMultiplier: 2.0,
      emaFilterPeriod: 0,
    });
    const engine = new BacktestEngine({
      initialCapital: 10_000_000,
      positionSizePct: 1.0,
      positionManager: { trailingStopAtrMultiplier: 3.0 },
    });

    const report = engine.run(candles, strategy);
    expect(report.startEquity).toBe(10_000_000);
    expect(report.totalTrades).toBeGreaterThanOrEqual(0);
    expect(report.equityCurve.length).toBe(candles.length);
  });

  it('should produce deterministic results', () => {
    const candles = generateSyntheticCandles(100);
    const makeStrategy = () => new DonchianBreakout({
      donchianPeriod: 10,
      atrPeriod: 5,
      atrStopMultiplier: 2.0,
      emaFilterPeriod: 0,
    });
    const config = {
      initialCapital: 10_000_000,
      positionSizePct: 1.0,
      positionManager: { trailingStopAtrMultiplier: 3.0 },
    };

    const engine1 = new BacktestEngine(config);
    const report1 = engine1.run(candles, makeStrategy());
    const log1 = engine1.getEventLog();

    const engine2 = new BacktestEngine(config);
    const report2 = engine2.run(candles, makeStrategy());
    const log2 = engine2.getEventLog();

    // 동일 입력 → 동일 결과
    expect(report1.totalPnl).toBe(report2.totalPnl);
    expect(report1.totalTrades).toBe(report2.totalTrades);
    expect(log1.length).toBe(log2.length);

    // 이벤트 로그 동일성
    for (let i = 0; i < log1.length; i++) {
      expect(log1[i]!.type).toBe(log2[i]!.type);
      expect(log1[i]!.timestamp).toBe(log2[i]!.timestamp);
    }
  });

  it('should compute valid metrics', () => {
    const candles = generateSyntheticCandles(200);
    const strategy = new DonchianBreakout({
      donchianPeriod: 10,
      atrPeriod: 5,
      atrStopMultiplier: 2.0,
      emaFilterPeriod: 0,
    });
    const engine = new BacktestEngine({
      initialCapital: 10_000_000,
      positionSizePct: 1.0,
      positionManager: { trailingStopAtrMultiplier: 3.0 },
    });

    const report = engine.run(candles, strategy);

    expect(report.winRate).toBeGreaterThanOrEqual(0);
    expect(report.winRate).toBeLessThanOrEqual(1);
    expect(report.maxDrawdown).toBeGreaterThanOrEqual(0);
    expect(report.winCount + report.lossCount).toBe(report.totalTrades);

    if (report.totalTrades > 0) {
      expect(report.profitFactor).toBeGreaterThanOrEqual(0);
    }
  });
});
