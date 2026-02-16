import type { TradeRecord, BacktestReport, EquityPoint, MonthlyPnl } from '../types/index.js';

export function buildReport(
  trades: TradeRecord[],
  equityCurve: EquityPoint[],
  startEquity: number,
  endEquity: number,
): BacktestReport {
  const wins = trades.filter((t) => t.pnl > 0);
  const losses = trades.filter((t) => t.pnl <= 0);

  const totalPnl = trades.reduce((s, t) => s + t.pnl, 0);
  const totalReturn = startEquity > 0 ? (totalPnl / startEquity) * 100 : 0;

  const grossProfit = wins.reduce((s, t) => s + t.pnl, 0);
  const grossLoss = Math.abs(losses.reduce((s, t) => s + t.pnl, 0));

  return {
    totalTrades: trades.length,
    winCount: wins.length,
    lossCount: losses.length,
    winRate: trades.length > 0 ? wins.length / trades.length : 0,
    totalPnl,
    totalReturn,
    cagr: calcCagr(equityCurve, startEquity, endEquity),
    maxDrawdown: calcMaxDrawdown(equityCurve),
    profitFactor: grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0,
    expectancy: trades.length > 0 ? totalPnl / trades.length : 0,
    avgWin: wins.length > 0 ? grossProfit / wins.length : 0,
    avgLoss: losses.length > 0 ? grossLoss / losses.length : 0,
    maxConsecutiveLosses: calcMaxConsecutiveLosses(trades),
    sharpeRatio: calcSharpe(trades),
    startEquity,
    endEquity,
    trades,
    equityCurve,
    monthlyPnl: calcMonthlyPnl(trades),
  };
}

function calcCagr(
  curve: EquityPoint[],
  startEquity: number,
  endEquity: number,
): number {
  if (curve.length < 2 || startEquity <= 0) return 0;
  const startMs = curve[0]!.timestamp;
  const endMs = curve[curve.length - 1]!.timestamp;
  const years = (endMs - startMs) / (365.25 * 24 * 3600 * 1000);
  if (years <= 0) return 0;
  return (Math.pow(endEquity / startEquity, 1 / years) - 1) * 100;
}

function calcMaxDrawdown(curve: EquityPoint[]): number {
  if (curve.length === 0) return 0;
  let peak = curve[0]!.equity;
  let maxDd = 0;

  for (const point of curve) {
    if (point.equity > peak) peak = point.equity;
    const dd = (peak - point.equity) / peak;
    if (dd > maxDd) maxDd = dd;
  }

  return maxDd * 100;
}

function calcMaxConsecutiveLosses(trades: TradeRecord[]): number {
  let max = 0;
  let current = 0;
  for (const t of trades) {
    if (t.pnl <= 0) {
      current++;
      if (current > max) max = current;
    } else {
      current = 0;
    }
  }
  return max;
}

function calcSharpe(trades: TradeRecord[]): number {
  if (trades.length < 2) return 0;
  const returns = trades.map((t) => t.pnlPct);
  const mean = returns.reduce((s, r) => s + r, 0) / returns.length;
  const variance = returns.reduce((s, r) => s + (r - mean) ** 2, 0) / (returns.length - 1);
  const std = Math.sqrt(variance);
  if (std === 0) return 0;
  // 연환산: 5분봉 기준 약 105,120 bar/year
  const barsPerYear = 105_120;
  const avgBarsPerTrade = trades.reduce((s, t) => s + t.holdingBars, 0) / trades.length;
  const tradesPerYear = avgBarsPerTrade > 0 ? barsPerYear / avgBarsPerTrade : 1;
  return (mean / std) * Math.sqrt(tradesPerYear);
}

function calcMonthlyPnl(trades: TradeRecord[]): MonthlyPnl[] {
  const map = new Map<string, MonthlyPnl>();

  for (const t of trades) {
    const d = new Date(t.exitTime);
    const year = d.getFullYear();
    const month = d.getMonth() + 1;
    const key = `${year}-${month}`;

    const existing = map.get(key);
    if (existing) {
      map.set(key, {
        year,
        month,
        pnl: existing.pnl + t.pnl,
        pnlPct: existing.pnlPct + t.pnlPct,
        tradeCount: existing.tradeCount + 1,
      });
    } else {
      map.set(key, {
        year,
        month,
        pnl: t.pnl,
        pnlPct: t.pnlPct,
        tradeCount: 1,
      });
    }
  }

  return Array.from(map.values()).sort(
    (a, b) => a.year - b.year || a.month - b.month,
  );
}
