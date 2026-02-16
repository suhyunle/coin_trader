import type { BacktestReport, MonthlyPnl } from '../types/index.js';

/**
 * 콘솔 테이블 출력 (외부 의존성 없음)
 */
export function formatReport(report: BacktestReport): string {
  const lines: string[] = [];

  lines.push('');
  lines.push('═══════════════════════════════════════════');
  lines.push('          BACKTEST REPORT');
  lines.push('═══════════════════════════════════════════');
  lines.push('');

  lines.push(formatSection('Performance', [
    ['Total Return', `${report.totalReturn.toFixed(2)}%`],
    ['CAGR', `${report.cagr.toFixed(2)}%`],
    ['Max Drawdown', `${report.maxDrawdown.toFixed(2)}%`],
    ['Sharpe Ratio', report.sharpeRatio.toFixed(2)],
    ['Profit Factor', report.profitFactor === Infinity ? 'INF' : report.profitFactor.toFixed(2)],
  ]));

  lines.push(formatSection('Trades', [
    ['Total Trades', String(report.totalTrades)],
    ['Win Rate', `${(report.winRate * 100).toFixed(1)}%`],
    ['Wins / Losses', `${report.winCount} / ${report.lossCount}`],
    ['Avg Win', formatKrw(report.avgWin)],
    ['Avg Loss', formatKrw(report.avgLoss)],
    ['Expectancy', formatKrw(report.expectancy)],
    ['Max Consec. Losses', String(report.maxConsecutiveLosses)],
  ]));

  lines.push(formatSection('Capital', [
    ['Start Equity', formatKrw(report.startEquity)],
    ['End Equity', formatKrw(report.endEquity)],
    ['Total PnL', formatKrw(report.totalPnl)],
  ]));

  if (report.monthlyPnl.length > 0) {
    lines.push('');
    lines.push('── Monthly PnL ──────────────────────────');
    lines.push(formatMonthlyTable(report.monthlyPnl));
  }

  lines.push('');
  return lines.join('\n');
}

function formatSection(title: string, rows: [string, string][]): string {
  const lines: string[] = [];
  lines.push(`── ${title} ${'─'.repeat(38 - title.length)}`);
  for (const [key, value] of rows) {
    lines.push(`  ${key.padEnd(22)} ${value}`);
  }
  lines.push('');
  return lines.join('\n');
}

function formatKrw(value: number): string {
  const sign = value >= 0 ? '' : '-';
  const abs = Math.abs(value);
  if (abs >= 1_000_000) {
    return `${sign}${(abs / 1_000_000).toFixed(2)}M KRW`;
  }
  if (abs >= 1_000) {
    return `${sign}${(abs / 1_000).toFixed(1)}K KRW`;
  }
  return `${sign}${abs.toFixed(0)} KRW`;
}

function formatMonthlyTable(monthly: MonthlyPnl[]): string {
  const lines: string[] = [];
  lines.push('  Year-Mo    PnL          Trades');
  lines.push('  ────────── ──────────── ──────');

  for (const m of monthly) {
    const ym = `${m.year}-${String(m.month).padStart(2, '0')}`;
    const pnl = formatKrw(m.pnl).padStart(12);
    lines.push(`  ${ym}   ${pnl}   ${String(m.tradeCount).padStart(4)}`);
  }

  return lines.join('\n');
}

/**
 * 트레이드 목록 출력
 */
export function formatTrades(report: BacktestReport): string {
  if (report.trades.length === 0) return 'No trades.';

  const lines: string[] = [];
  lines.push('  #   Entry Date         Exit Date          Entry Price    Exit Price     PnL%     Bars');
  lines.push('  ─── ────────────────── ────────────────── ──────────── ──────────── ──────── ────');

  for (let i = 0; i < report.trades.length; i++) {
    const t = report.trades[i]!;
    const num = String(i + 1).padStart(3);
    const entry = formatDate(t.entryTime);
    const exit = formatDate(t.exitTime);
    const ep = String(Math.round(t.entryPrice)).padStart(12);
    const xp = String(Math.round(t.exitPrice)).padStart(12);
    const pnl = `${t.pnlPct >= 0 ? '+' : ''}${t.pnlPct.toFixed(2)}%`.padStart(8);
    const bars = String(t.holdingBars).padStart(4);
    lines.push(`  ${num} ${entry} ${exit} ${ep} ${xp} ${pnl} ${bars}`);
  }

  return lines.join('\n');
}

function formatDate(ms: number): string {
  const d = new Date(ms);
  return d.toISOString().slice(0, 16).replace('T', ' ');
}
