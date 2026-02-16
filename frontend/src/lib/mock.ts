import type { AppState, CandleDto, PositionDto, RiskDto, TimelineEventDto, StrategyDto } from "@/types/api";

export const mockState: AppState = {
  mode: "PAPER",
  auto: true,
  kill: false,
  wsStatus: "CONNECTED",
  latencyMs: 42,
  rateLimitOk: true,
  lastError: null,
  liveTradingAvailable: false,
};

export const mockCandles: CandleDto[] = (() => {
  const now = Date.now();
  const m5 = 5 * 60 * 1000;
  const out: CandleDto[] = [];
  let base = 98_000_000;
  for (let i = 200; i >= 0; i--) {
    const t = now - i * m5;
    const o = base;
    const c = o + (Math.random() - 0.48) * 500_000;
    const h = Math.max(o, c) + Math.random() * 100_000;
    const l = Math.min(o, c) - Math.random() * 100_000;
    base = c;
    out.push({
      timestamp: t,
      open: Math.round(o),
      high: Math.round(h),
      low: Math.round(l),
      close: Math.round(c),
      volume: Math.round((0.001 + Math.random() * 0.01) * 1e8) / 1e8,
    });
  }
  return out;
})();

export const mockPosition: PositionDto = {
  status: "FLAT",
  qty: 0,
  entryPrice: 0,
  stopLoss: 0,
  unrealizedPnl: 0,
  unrealizedPnlPct: 0,
  stopArmed: true,
};

export const mockRisk: RiskDto = {
  riskPerTradePct: 1,
  dailyLossLimitPct: 3,
  dailyPnl: 0,
  maxOrderKrw: 500_000,
  cooldownRemainingSec: 0,
  riskOk: true,
  blockedReason: null,
};

// 고정 타임스탬프 사용 → 서버/클라이언트 수화 일치 (Date.now() 사용 시 hydration 오류)
const MOCK_EVENTS_BASE_TS = 1737000000000;
export const mockEvents: TimelineEventDto[] = [
  { id: "1", ts: MOCK_EVENTS_BASE_TS - 60_000, type: "signal", summary: "HOLD", detail: "Close below Donchian upper" },
  { id: "2", ts: MOCK_EVENTS_BASE_TS - 120_000, type: "fill", summary: "SELL 0.002 BTC @ 98,100,000", detail: "Stop hit" },
  { id: "3", ts: MOCK_EVENTS_BASE_TS - 300_000, type: "signal", summary: "LONG_ENTRY", detail: "Close above Donchian upper, above EMA" },
];

export const mockStrategy: StrategyDto = {
  name: "DonchianBreakout",
  params: { donchianPeriod: 20, atrPeriod: 14, emaFilterPeriod: 50 },
  currentSignal: "HOLD",
  signalReason: "Close below Donchian upper",
  promotionProgress: { days: 9, required: 14, trades: 87, requiredTrades: 200 },
};
