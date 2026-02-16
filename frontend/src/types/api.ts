/**
 * 프론트 대시보드 API 계약 (백엔드 연동 시 사용)
 *
 * GET  /state            → AppState
 * GET  /market/candles    ?tf=5m&limit=500 → CandleDto[]
 * GET  /position          → PositionDto
 * GET  /risk              → RiskDto
 * GET  /events            ?limit=200 → TimelineEventDto[]
 * POST /control/mode      body: { mode }
 * POST /control/auto      body: { on }
 * POST /control/kill
 * POST /control/close     (수동 청산, 확인 필수)
 */

export type TradingMode = "BACKTEST" | "PAPER" | "LIVE";
export type WsStatus = "CONNECTED" | "CONNECTING" | "RECONNECTING" | "CLOSED";

export interface AppState {
  mode: TradingMode;
  auto: boolean;
  kill?: boolean;
  wsStatus: WsStatus;
  latencyMs: number;
  rateLimitOk: boolean;
  lastError: string | null;
  /** true면 백엔드가 LIVE로 기동되어 테스트 주문 가능 (대시보드에서 LIVE로 바꿔도 서버가 PAPER면 false) */
  liveTradingAvailable?: boolean;
}

export interface CandleDto {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface PositionDto {
  status: "FLAT" | "LONG";
  qty: number;
  entryPrice: number;
  stopLoss: number;
  unrealizedPnl: number;
  unrealizedPnlPct: number;
  stopArmed: boolean;
}

export interface RiskDto {
  riskPerTradePct: number;
  dailyLossLimitPct: number;
  dailyPnl: number;
  maxOrderKrw: number;
  cooldownRemainingSec: number;
  riskOk: boolean;
  blockedReason: string | null;
}

export interface TimelineEventDto {
  id: string;
  ts: number;
  type: "signal" | "order" | "fill" | "log";
  summary: string;
  detail?: string;
}

/** 매수/매도 한 건 (라운드 트립) */
export interface TradeDto {
  entryTime: number;
  exitTime: number;
  entryPrice: number;
  exitPrice: number;
  qty: number;
  pnl: number;
  pnlPct: number;
  holdingBars: number;
  reason: string;
}

export interface StrategyDto {
  name: string;
  params: Record<string, number>;
  currentSignal: "BUY" | "SELL" | "HOLD";
  signalReason: string;
  promotionProgress: { days: number; required: number; trades: number; requiredTrades: number };
}

/** 거래소 목록 API 항목 */
export interface ExchangeDto {
  id: string;
  name: string;
  nameEn: string;
  country: string;
  active: boolean;
  defaultMarket?: string;
  docsUrl?: string;
}
