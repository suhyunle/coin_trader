/**
 * 전략별 자금/포지션 분리 — 충돌 방지
 */

export type StrategyId = 'donchian' | 'dca' | 'rsi_fear';

/** 전략별 최대 자금 배분 비율 (0~1, 합계 1 권장) */
export interface AllocationConfig {
  donchian: number;
  dca: number;
  rsi_fear: number;
}

/** 장기 DCA 포지션 (매도 없음, 누적 매수만) */
export interface LongTermSlice {
  readonly strategyId: 'dca';
  cashKrw: number;
  btcQty: number;
  /** 누적 매수 평균 단가 (KRW) */
  avgCostKrw: number;
  /** 누적 투자 금액 (KRW) */
  totalInvestedKrw: number;
  /** 급락 DCA 마지막 실행 시각 (ms) */
  lastDipBuyAt: number;
}

/** 단기 전략 포지션 (1포지션, 진입/청산) */
export interface ShortTermSlice {
  readonly strategyId: 'rsi_fear';
  cashKrw: number;
  btcQty: number;
  /** 현재 포지션 진입가 (있을 때만) */
  entryPriceKrw: number;
  /** 진입 시각 */
  entryTime: number;
  /** 손절가 */
  stopLossKrw: number;
  /** 트레일링 스톱 */
  trailingStopKrw: number;
  /** 분할 매수 남은 횟수 (3회 중 0이면 전량 진입 완료) */
  entrySplitsLeft: number;
}

/** Donchian 기존 엔진은 기존 equity/position 유지, 타입만 참조 */
export interface PortfolioState {
  longTerm: LongTermSlice;
  shortTerm: ShortTermSlice;
}
