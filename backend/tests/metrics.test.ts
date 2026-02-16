import { describe, it, expect } from 'vitest';
import { buildReport } from '../src/report/metrics.js';
import type { TradeRecord, EquityPoint } from '../src/types/index.js';

describe('metrics', () => {
  it('should compute metrics from known trades', () => {
    const trades: TradeRecord[] = [
      { entryTime: 1000, exitTime: 2000, entryPrice: 100, exitPrice: 110, qty: 1, pnl: 10, pnlPct: 10, holdingBars: 5, reason: 'test' },
      { entryTime: 3000, exitTime: 4000, entryPrice: 110, exitPrice: 100, qty: 1, pnl: -10, pnlPct: -9.09, holdingBars: 5, reason: 'test' },
      { entryTime: 5000, exitTime: 6000, entryPrice: 100, exitPrice: 120, qty: 1, pnl: 20, pnlPct: 20, holdingBars: 5, reason: 'test' },
    ];

    const equityCurve: EquityPoint[] = [
      { timestamp: 1000, equity: 1000 },
      { timestamp: 2000, equity: 1010 },
      { timestamp: 3000, equity: 1010 },
      { timestamp: 4000, equity: 1000 },
      { timestamp: 5000, equity: 1000 },
      { timestamp: 6000, equity: 1020 },
    ];

    const report = buildReport(trades, equityCurve, 1000, 1020);

    expect(report.totalTrades).toBe(3);
    expect(report.winCount).toBe(2);
    expect(report.lossCount).toBe(1);
    expect(report.winRate).toBeCloseTo(2/3, 5);
    expect(report.totalPnl).toBe(20);
    expect(report.profitFactor).toBeCloseTo(30/10, 5); // 3.0
    expect(report.expectancy).toBeCloseTo(20/3, 5);
    expect(report.avgWin).toBeCloseTo(15, 5);
    expect(report.avgLoss).toBeCloseTo(10, 5);
    expect(report.maxConsecutiveLosses).toBe(1);
    expect(report.maxDrawdown).toBeGreaterThan(0);
  });

  it('should handle empty trades', () => {
    const report = buildReport([], [], 1000, 1000);
    expect(report.totalTrades).toBe(0);
    expect(report.winRate).toBe(0);
    expect(report.profitFactor).toBe(0);
    expect(report.maxDrawdown).toBe(0);
  });

  it('should compute max consecutive losses', () => {
    const trades: TradeRecord[] = [
      { entryTime: 1, exitTime: 2, entryPrice: 100, exitPrice: 90, qty: 1, pnl: -10, pnlPct: -10, holdingBars: 1, reason: '' },
      { entryTime: 3, exitTime: 4, entryPrice: 100, exitPrice: 90, qty: 1, pnl: -10, pnlPct: -10, holdingBars: 1, reason: '' },
      { entryTime: 5, exitTime: 6, entryPrice: 100, exitPrice: 90, qty: 1, pnl: -10, pnlPct: -10, holdingBars: 1, reason: '' },
      { entryTime: 7, exitTime: 8, entryPrice: 100, exitPrice: 110, qty: 1, pnl: 10, pnlPct: 10, holdingBars: 1, reason: '' },
      { entryTime: 9, exitTime: 10, entryPrice: 100, exitPrice: 90, qty: 1, pnl: -10, pnlPct: -10, holdingBars: 1, reason: '' },
    ];

    const report = buildReport(trades, [], 1000, 970);
    expect(report.maxConsecutiveLosses).toBe(3);
  });
});
