import type { Candle, BacktestReport } from '../types/index.js';
import type { Strategy, StrategyParams } from '../strategy/strategy.js';
import { BacktestEngine, type BacktestConfig } from '../engine/backtest-engine.js';

export interface ParamRange {
  readonly name: string;
  readonly min: number;
  readonly max: number;
  readonly step: number;
}

export interface SweepResult {
  readonly params: StrategyParams;
  readonly report: BacktestReport;
}

type StrategyFactory = (params: StrategyParams) => Strategy;

/**
 * 파라미터 그리드 탐색
 */
export function paramSweep(
  candles: Candle[],
  ranges: ParamRange[],
  factory: StrategyFactory,
  engineConfig?: Partial<BacktestConfig>,
): SweepResult[] {
  const combos = generateCombinations(ranges);
  const results: SweepResult[] = [];

  for (const params of combos) {
    const engine = new BacktestEngine(engineConfig);
    const strategy = factory(params);
    const report = engine.run(candles, strategy);
    results.push({ params, report });
  }

  // PF 기준 내림차순 정렬
  results.sort((a, b) => {
    const pfA = a.report.profitFactor === Infinity ? 1e9 : a.report.profitFactor;
    const pfB = b.report.profitFactor === Infinity ? 1e9 : b.report.profitFactor;
    return pfB - pfA;
  });

  return results;
}

function generateCombinations(ranges: ParamRange[]): StrategyParams[] {
  if (ranges.length === 0) return [{}];

  const first = ranges[0]!;
  const rest = ranges.slice(1);
  const restCombos = generateCombinations(rest);
  const result: StrategyParams[] = [];

  for (let v = first.min; v <= first.max; v += first.step) {
    // 부동소수점 보정
    const val = Math.round(v * 1e8) / 1e8;
    for (const combo of restCombos) {
      result.push({ [first.name]: val, ...combo });
    }
  }

  return result;
}

export function formatSweepResults(results: SweepResult[], top: number = 10): string {
  const lines: string[] = [];
  lines.push('');
  lines.push('═══════════════════════════════════════════════════════');
  lines.push('          PARAMETER SWEEP RESULTS');
  lines.push(`          Total combinations: ${results.length}`);
  lines.push('═══════════════════════════════════════════════════════');
  lines.push('');

  const show = results.slice(0, top);
  for (let i = 0; i < show.length; i++) {
    const r = show[i]!;
    const paramStr = Object.entries(r.params)
      .map(([k, v]) => `${k}=${v}`)
      .join(', ');
    lines.push(`#${i + 1}  ${paramStr}`);
    lines.push(`    Return: ${r.report.totalReturn.toFixed(2)}%  |  PF: ${r.report.profitFactor === Infinity ? 'INF' : r.report.profitFactor.toFixed(2)}  |  MDD: ${r.report.maxDrawdown.toFixed(2)}%  |  Trades: ${r.report.totalTrades}  |  WR: ${(r.report.winRate * 100).toFixed(1)}%`);
    lines.push('');
  }

  return lines.join('\n');
}
