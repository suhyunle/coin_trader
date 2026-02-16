import { config } from './config.js';
import type { LongTermSlice, ShortTermSlice, PortfolioState } from './types/portfolio.js';

function createLongTermSlice(): LongTermSlice {
  const krw = config.capital.initialKrw * config.capital.maxAllocationDca;
  return {
    strategyId: 'dca',
    cashKrw: krw,
    btcQty: 0,
    avgCostKrw: 0,
    totalInvestedKrw: 0,
    lastDipBuyAt: 0,
  };
}

function createShortTermSlice(): ShortTermSlice {
  const krw = config.capital.initialKrw * config.capital.maxAllocationRsiFear;
  return {
    strategyId: 'rsi_fear',
    cashKrw: krw,
    btcQty: 0,
    entryPriceKrw: 0,
    entryTime: 0,
    stopLossKrw: 0,
    trailingStopKrw: 0,
    entrySplitsLeft: config.strategyB_RSI_Fear.entrySplits,
  };
}

let state: PortfolioState = {
  longTerm: createLongTermSlice(),
  shortTerm: createShortTermSlice(),
};

export const portfolioTracker = {
  getLongTerm(): Readonly<LongTermSlice> {
    return state.longTerm;
  },

  getShortTerm(): Readonly<ShortTermSlice> {
    return state.shortTerm;
  },

  getState(): Readonly<PortfolioState> {
    return state;
  },

  /** DCA 매수 반영: cash 감소, btc 증가, 평균단가·누적투자금 갱신 */
  applyDcaBuy(krwSpent: number, btcBought: number, _priceKrw: number): void {
    const lt = state.longTerm;
    const newTotal = lt.totalInvestedKrw + krwSpent;
    const newQty = lt.btcQty + btcBought;
    state = {
      ...state,
      longTerm: {
        ...lt,
        cashKrw: lt.cashKrw - krwSpent,
        btcQty: newQty,
        avgCostKrw: newQty > 0 ? newTotal / newQty : 0,
        totalInvestedKrw: newTotal,
      },
    };
  },

  /** 급락 DCA 실행 시각 기록 */
  setLastDipBuyAt(ts: number): void {
    state = {
      ...state,
      longTerm: { ...state.longTerm, lastDipBuyAt: ts },
    };
  },

  /** 단기 전략 진입 (분할 1회): cash 감소, btc 증가 */
  applyShortTermEntry(krwSpent: number, btcBought: number, priceKrw: number, stopLoss: number, splitsLeft: number): void {
    const st = state.shortTerm;
    state = {
      ...state,
      shortTerm: {
        ...st,
        cashKrw: st.cashKrw - krwSpent,
        btcQty: st.btcQty + btcBought,
        entryPriceKrw: st.btcQty > 0 ? (st.entryPriceKrw * st.btcQty + priceKrw * btcBought) / (st.btcQty + btcBought) : priceKrw,
        entryTime: st.entryTime || Date.now(),
        stopLossKrw: Math.max(st.stopLossKrw, stopLoss),
        trailingStopKrw: Math.max(st.trailingStopKrw, stopLoss),
        entrySplitsLeft: splitsLeft,
      },
    };
  },

  /** 단기 전략 청산: btc 0, cash 증가 */
  applyShortTermExit(krwReceived: number): void {
    const st = state.shortTerm;
    state = {
      ...state,
      shortTerm: {
        ...st,
        cashKrw: st.cashKrw + krwReceived,
        btcQty: 0,
        entryPriceKrw: 0,
        entryTime: 0,
        stopLossKrw: 0,
        trailingStopKrw: 0,
        entrySplitsLeft: config.strategyB_RSI_Fear.entrySplits,
      },
    };
  },

  /** 단기 트레일링 스톱 갱신 */
  updateShortTermTrailing(trailingStopKrw: number): void {
    const st = state.shortTerm;
    if (st.btcQty <= 0) return;
    state = {
      ...state,
      shortTerm: { ...st, trailingStopKrw: Math.max(st.trailingStopKrw, trailingStopKrw) },
    };
  },

  reset(): void {
    state = {
      longTerm: createLongTermSlice(),
      shortTerm: createShortTermSlice(),
    };
  },
};
