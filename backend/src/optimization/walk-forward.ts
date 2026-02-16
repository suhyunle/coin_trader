import type { Candle, BacktestReport } from '../types/index.js';
import type { StrategyParams } from '../strategy/strategy.js';
import { walkForwardSplit } from '../data/splitter.js';
import { paramSweep, type ParamRange } from './param-sweep.js';
import { BacktestEngine, type BacktestConfig } from '../engine/backtest-engine.js';

type StrategyFactory = (params: StrategyParams) => Strategy;

import type { Strategy } from '../strategy/strategy.js';

export interface WalkForwardResult {
  readonly windowIndex: number;
  readonly bestTrainParams: StrategyParams;
  readonly trainReport: BacktestReport;
  readonly testReport: BacktestReport;
}

export interface WalkForwardSummary {
  readonly windows: WalkForwardResult[];
  readonly combinedTestPnl: number;
  readonly combinedTestReturn: number;
  readonly avgTestReturn: number;
  readonly robustnessRatio: number;  // test avg return / train avg return
}

/**
 * 워크포워드 분석
 * 각 윈도우에서: train으로 최적 파라미터 찾고 → test에 적용
 */
export function walkForwardAnalysis(
  candles: Candle[],
  trainBars: number,
  testBars: number,
  ranges: ParamRange[],
  factory: StrategyFactory,
  engineConfig?: Partial<BacktestConfig>,
  stepBars?: number,
): WalkForwardSummary {
  const windows = walkForwardSplit(candles, trainBars, testBars, stepBars);

  if (windows.length === 0) {
    throw new Error('Not enough data for walk-forward analysis');
  }

  const results: WalkForwardResult[] = [];

  for (const w of windows) {
    // Train: 파라미터 스윕으로 최적 파라미터 선택
    const sweepResults = paramSweep(w.train, ranges, factory, engineConfig);
    const best = sweepResults[0];

    if (!best) {
      throw new Error(`Window ${w.windowIndex}: no sweep results`);
    }

    // Test: 최적 파라미터로 OOS 테스트
    const testEngine = new BacktestEngine(engineConfig);
    const testStrategy = factory(best.params);
    const testReport = testEngine.run(w.test, testStrategy);

    results.push({
      windowIndex: w.windowIndex,
      bestTrainParams: best.params,
      trainReport: best.report,
      testReport,
    });
  }

  const combinedTestPnl = results.reduce((s, r) => s + r.testReport.totalPnl, 0);
  const avgTestReturn = results.reduce((s, r) => s + r.testReport.totalReturn, 0) / results.length;
  const avgTrainReturn = results.reduce((s, r) => s + r.trainReport.totalReturn, 0) / results.length;
  const initialCapital = engineConfig?.initialCapital ?? 10_000_000;

  return {
    windows: results,
    combinedTestPnl,
    combinedTestReturn: (combinedTestPnl / initialCapital) * 100,
    avgTestReturn,
    robustnessRatio: avgTrainReturn !== 0 ? avgTestReturn / avgTrainReturn : 0,
  };
}

export function formatWalkForward(summary: WalkForwardSummary): string {
  const lines: string[] = [];
  lines.push('');
  lines.push('═══════════════════════════════════════════════════════');
  lines.push('          WALK-FORWARD ANALYSIS');
  lines.push(`          Windows: ${summary.windows.length}`);
  lines.push('═══════════════════════════════════════════════════════');
  lines.push('');

  for (const w of summary.windows) {
    const paramStr = Object.entries(w.bestTrainParams)
      .map(([k, v]) => `${k}=${v}`)
      .join(', ');
    lines.push(`Window #${w.windowIndex}`);
    lines.push(`  Params: ${paramStr}`);
    lines.push(`  Train:  Return ${w.trainReport.totalReturn.toFixed(2)}%  PF ${w.trainReport.profitFactor === Infinity ? 'INF' : w.trainReport.profitFactor.toFixed(2)}  Trades ${w.trainReport.totalTrades}`);
    lines.push(`  Test:   Return ${w.testReport.totalReturn.toFixed(2)}%  PF ${w.testReport.profitFactor === Infinity ? 'INF' : w.testReport.profitFactor.toFixed(2)}  Trades ${w.testReport.totalTrades}`);
    lines.push('');
  }

  lines.push('── Summary ─────────────────────────────');
  lines.push(`  Combined Test PnL:    ${summary.combinedTestPnl.toFixed(0)} KRW`);
  lines.push(`  Combined Test Return: ${summary.combinedTestReturn.toFixed(2)}%`);
  lines.push(`  Avg Test Return:      ${summary.avgTestReturn.toFixed(2)}%`);
  lines.push(`  Robustness Ratio:     ${summary.robustnessRatio.toFixed(2)} (test/train)`);
  lines.push('');

  return lines.join('\n');
}
