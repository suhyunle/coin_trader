import { loadCsv } from './data/csv-loader.js';

import { BacktestEngine } from './engine/backtest-engine.js';
import { DonchianBreakout } from './strategy/donchian-breakout.js';
import type { StrategyParams } from './strategy/strategy.js';
import { formatReport, formatTrades } from './report/formatter.js';
import { paramSweep, formatSweepResults, type ParamRange } from './optimization/param-sweep.js';
import { walkForwardAnalysis, formatWalkForward } from './optimization/walk-forward.js';

function printUsage(): void {
  console.log(`
Usage:
  tsx src/index.ts backtest <csv-file> [options]
  tsx src/index.ts sweep <csv-file> [options]
  tsx src/index.ts walkforward <csv-file> [options]

Commands:
  backtest      Run single backtest with default or specified params
  sweep         Parameter grid search
  walkforward   Walk-forward analysis

Options:
  --capital <number>        Initial capital in KRW (default: 10000000)
  --donchian <number>       Donchian period (default: 20)
  --atr <number>            ATR period (default: 14)
  --atr-stop <number>       ATR stop multiplier (default: 2.0)
  --ema <number>            EMA filter period, 0=disabled (default: 50)
  --trailing <number>       Trailing stop ATR multiplier (default: 3.0)
  --fee <number>            Fee rate (default: 0.0005)
  --slippage <number>       Slippage bps (default: 5)
  --trades                  Show individual trades
  --train-ratio <number>    Train/test split ratio (default: 0.7)
  --train-bars <number>     Walk-forward train bars (default: 2016)
  --test-bars <number>      Walk-forward test bars (default: 576)

Sweep grid: donchianPeriod 10,20,30 × atrStopMultiplier 2.0,2.5,3.0 (PF/MDD/WR/Trades 비교).
스프레드 필터는 PAPER/LIVE에서 .env MIN_SPREAD_BPS(예: 15,25,40)로 별도 적용.
`);
}

function parseArgs(args: string[]): Map<string, string> {
  const map = new Map<string, string>();
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;
    if (arg.startsWith('--')) {
      const next = args[i + 1];
      if (next && !next.startsWith('--')) {
        map.set(arg, next);
        i++;
      } else {
        map.set(arg, 'true');
      }
    } else if (!map.has('_command')) {
      map.set('_command', arg);
    } else if (!map.has('_file')) {
      map.set('_file', arg);
    }
  }
  return map;
}

function getNum(args: Map<string, string>, key: string, def: number): number {
  const v = args.get(key);
  return v ? Number(v) : def;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const command = args.get('_command');
  const file = args.get('_file');

  if (!command || !file) {
    printUsage();
    process.exit(1);
  }

  const candles = loadCsv(file);
  console.log(`Loaded ${candles.length} candles from ${file}`);

  const capital = getNum(args, '--capital', 10_000_000);
  const donchianPeriod = getNum(args, '--donchian', 20);
  const atrPeriod = getNum(args, '--atr', 14);
  const atrStopMultiplier = getNum(args, '--atr-stop', 2.0);
  const emaFilterPeriod = getNum(args, '--ema', 50);
  const trailingMultiplier = getNum(args, '--trailing', 3.0);
  const feeRate = getNum(args, '--fee', 0.0005);
  const slippageBps = getNum(args, '--slippage', 5);

  const engineConfig = {
    initialCapital: capital,
    positionSizePct: 1.0,
    fillModel: { feeRate, slippageBps },
    positionManager: { trailingStopAtrMultiplier: trailingMultiplier },
    atrPeriod,
  };

  switch (command) {
    case 'backtest': {
      const strategy = new DonchianBreakout({
        donchianPeriod,
        atrPeriod,
        atrStopMultiplier,
        emaFilterPeriod,
      });
      const engine = new BacktestEngine(engineConfig);
      const report = engine.run(candles, strategy);
      console.log(formatReport(report));
      if (args.has('--trades')) {
        console.log(formatTrades(report));
      }
      break;
    }

    case 'sweep': {
      // 목표: "안 터지는 조합" — PF, MDD, 승률, 트레이드 수 비교
      const ranges: ParamRange[] = [
        { name: 'donchianPeriod', min: 10, max: 30, step: 10 },   // 10, 20, 30
        { name: 'atrStopMultiplier', min: 2.0, max: 3.0, step: 0.5 }, // 2.0, 2.5, 3.0
      ];
      const factory = (params: StrategyParams) =>
        new DonchianBreakout({ ...params, atrPeriod, emaFilterPeriod });
      const results = paramSweep(candles, ranges, factory, engineConfig);
      console.log(formatSweepResults(results, 15));
      break;
    }

    case 'walkforward': {
      const trainBars = getNum(args, '--train-bars', 2016);  // ~1주 5분봉
      const testBars = getNum(args, '--test-bars', 576);     // ~2일
      const ranges: ParamRange[] = [
        { name: 'donchianPeriod', min: 10, max: 40, step: 5 },
        { name: 'atrPeriod', min: 10, max: 20, step: 5 },
        { name: 'atrStopMultiplier', min: 1.5, max: 3.0, step: 0.5 },
      ];
      const factory = (params: StrategyParams) =>
        new DonchianBreakout({ ...params, emaFilterPeriod });
      const summary = walkForwardAnalysis(
        candles, trainBars, testBars, ranges, factory, engineConfig,
      );
      console.log(formatWalkForward(summary));
      break;
    }

    default:
      console.error(`Unknown command: ${command}`);
      printUsage();
      process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
