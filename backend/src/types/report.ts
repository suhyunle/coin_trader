export interface TradeRecord {
  readonly entryTime: number;
  readonly exitTime: number;
  readonly entryPrice: number;
  readonly exitPrice: number;
  readonly qty: number;
  readonly pnl: number;           // KRW
  readonly pnlPct: number;        // %
  readonly holdingBars: number;
  readonly reason: string;
}

export interface BacktestReport {
  readonly totalTrades: number;
  readonly winCount: number;
  readonly lossCount: number;
  readonly winRate: number;         // 0~1
  readonly totalPnl: number;       // KRW
  readonly totalReturn: number;    // %
  readonly cagr: number;           // %
  readonly maxDrawdown: number;    // % (양수)
  readonly profitFactor: number;
  readonly expectancy: number;     // 1트레이드 평균 기대값 KRW
  readonly avgWin: number;         // KRW
  readonly avgLoss: number;        // KRW
  readonly maxConsecutiveLosses: number;
  readonly sharpeRatio: number;
  readonly startEquity: number;
  readonly endEquity: number;
  readonly trades: TradeRecord[];
  readonly equityCurve: EquityPoint[];
  readonly monthlyPnl: MonthlyPnl[];
}

export interface EquityPoint {
  readonly timestamp: number;
  readonly equity: number;
}

export interface MonthlyPnl {
  readonly year: number;
  readonly month: number;
  readonly pnl: number;
  readonly pnlPct: number;
  readonly tradeCount: number;
}
