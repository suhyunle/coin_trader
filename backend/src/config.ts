import 'dotenv/config';

function env(key: string, fallback: string): string {
  return process.env[key] ?? fallback;
}

function envNum(key: string, fallback: number): number {
  const v = process.env[key];
  return v !== undefined ? Number(v) : fallback;
}

export type TradingMode = 'BACKTEST' | 'PAPER' | 'LIVE';

export const config = {
  mode: env('MODE', 'PAPER') as TradingMode,

  bithumb: {
    accessKey: env('BITHUMB_ACCESS_KEY', ''),
    secretKey: env('BITHUMB_SECRET_KEY', ''),
    wsUrl: 'wss://ws-api.bithumb.com/websocket/v1',
    restBaseUrl: 'https://api.bithumb.com',
  },

  risk: {
    riskPerTradePct: envNum('RISK_PER_TRADE_PCT', 0.01),
    maxDailyLossPct: envNum('MAX_DAILY_LOSS_PCT', 0.03),
    maxPositionKrw: envNum('MAX_POSITION_KRW', 500_000),
    maxDailyTrades: envNum('MAX_DAILY_TRADES', 10),
    cooldownMinutes: envNum('COOLDOWN_MINUTES', 30),
    minSpreadBps: envNum('MIN_SPREAD_BPS', 10),
    minAtrKrw: envNum('MIN_ATR_KRW', 50_000),
  },

  strategy: {
    donchianPeriod: envNum('DONCHIAN_PERIOD', 20),
    atrPeriod: envNum('ATR_PERIOD', 14),
    atrStopMultiplier: envNum('ATR_STOP_MULTIPLIER', 2.0),
    emaFilterPeriod: envNum('EMA_FILTER_PERIOD', 50),
    trailingStopAtrMultiplier: envNum('TRAILING_STOP_ATR_MULTIPLIER', 3.0),
  },

  execution: {
    feeRate: envNum('FEE_RATE', 0.0025),
    slippageBps: envNum('SLIPPAGE_BPS', 5),
    orderTimeoutMs: envNum('ORDER_TIMEOUT_MS', 5000),
    maxRetries: envNum('MAX_RETRIES', 3),
    /** 주문 전 현재가 검증: 캔들 종가와 티커 가격 차이 비율 초과 시 진입 스킵 (0.005 = 0.5%) */
    maxPriceDriftPct: envNum('MAX_PRICE_DRIFT_PCT', 0.5),
  },

  capital: {
    initialKrw: envNum('INITIAL_CAPITAL_KRW', 10_000_000),
  },

  promotion: {
    paperMinDays: envNum('PAPER_MIN_DAYS', 14),
    paperMinTrades: envNum('PAPER_MIN_TRADES', 200),
    paperMinPf: envNum('PAPER_MIN_PF', 1.2),
    paperMaxMddPct: envNum('PAPER_MAX_MDD_PCT', 20),
    paperMaxOrderFailPct: envNum('PAPER_MAX_ORDER_FAIL_PCT', 1),
  },

  db: {
    path: env('DB_PATH', './data/trading.db'),
  },

  log: {
    level: env('LOG_LEVEL', 'info'),
  },

  telegram: {
    enabled: env('TELEGRAM_ENABLED', 'false') === 'true',
    botToken: env('TELEGRAM_BOT_TOKEN', ''),
    chatId: env('TELEGRAM_CHAT_ID', ''),
  },

  /** 대시보드 API 서버 포트 (프론트 폴링용) */
  apiServerPort: envNum('API_SERVER_PORT', 4000),
} as const;
