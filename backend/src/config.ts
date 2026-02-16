import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// 루트 .env (monorepo에서 npm run backend 시 cwd가 backend/이므로 루트 .env가 안 읽힘 → 명시 로드)
dotenv.config({ path: path.join(__dirname, '..', '..', '.env') });
dotenv.config(); // backend/.env (cwd) — 있으면 이걸로 덮어씀

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
    /** 빗썸 Private/주문 API 베이스 */
    restBaseUrl: env('BITHUMB_BASE_URL', 'https://api.bithumb.com'),
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
    /** 전략별 자금 배분 비율 (합 1.0). donchian + dca + rsi_fear */
    maxAllocationDonchian: envNum('MAX_ALLOCATION_DONCHIAN', 0.5),
    maxAllocationDca: envNum('MAX_ALLOCATION_DCA', 0.3),
    maxAllocationRsiFear: envNum('MAX_ALLOCATION_RSI_FEAR', 0.2),
  },

  /** 전략 A: 장기 DCA */
  strategyA_DCA: {
    /** 정기 DCA: 매월 1회 실행일 (1~28) */
    monthlyDay: envNum('DCA_MONTHLY_DAY', 1),
    /** 주간 DCA 사용 시 요일 (0=일, 1=월, ... 6=토), -1이면 월간만 */
    weeklyDay: envNum('DCA_WEEKLY_DAY', -1),
    /** 정기 DCA 금액 (KRW) */
    monthlyAmountKRW: envNum('DCA_MONTHLY_AMOUNT_KRW', 100_000),
    /** 급락 시 추가 매수 금액 (KRW) */
    dipBuyKRW: envNum('DCA_DIP_BUY_KRW', 50_000),
    /** 급락 기준: 최근 N일 고가 대비 -X% */
    dipThresholdPct: envNum('DCA_DIP_THRESHOLD_PCT', 15),
    /** 급락 DCA 쿨다운 (일) */
    dipCooldownDays: envNum('DCA_DIP_COOLDOWN_DAYS', 7),
    /** 고가 기준 일수 */
    highLookbackDays: envNum('DCA_HIGH_LOOKBACK_DAYS', 30),
  },

  /** 전략 B: RSI + 공포지수 단기 */
  strategyB_RSI_Fear: {
    rsiPeriod: envNum('RSI_PERIOD', 14),
    rsiOversold: envNum('RSI_OVERSOLD', 30),
    rsiOverbought: envNum('RSI_OVERBOUGHT', 70),
    fearMax: envNum('FEAR_MAX', 20),
    entrySplits: envNum('RSI_ENTRY_SPLITS', 3),
    /** 단기 과열: 최근 10봉 누적 상승률 (%) */
    overheatRisePct: envNum('RSI_OVERHEAT_RISE_PCT', 5),
    overheatBars: envNum('RSI_OVERHEAT_BARS', 10),
    /** 고정 손절 (%) */
    stopLossPct: envNum('RSI_STOP_LOSS_PCT', 3),
    trailingStopAtrMultiplier: envNum('RSI_TRAILING_ATR_MULT', 2.0),
  },

  /** 공포탐욕지수 API 캐시 (분) */
  fearGreedCacheMinutes: envNum('FEAR_GREED_CACHE_MINUTES', 60),

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
