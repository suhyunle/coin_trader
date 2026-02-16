export type SignalAction = 'LONG_ENTRY' | 'LONG_EXIT' | 'NONE';

export interface StrategySignal {
  readonly action: SignalAction;
  readonly price?: number;       // 희망 가격 (시장가면 undefined)
  readonly stopLoss?: number;    // 진입 시 초기 SL
  readonly reason?: string;      // 디버그용
}
