export interface PositionSizing {
  readonly qty: number;        // BTC 수량
  readonly krwAmount: number;  // KRW 금액
  readonly riskKrw: number;    // 리스크 금액
  readonly stopLoss: number;   // SL 가격
}

export interface RiskCheck {
  readonly allowed: boolean;
  readonly reason?: string;
}

export type TradingState =
  | 'IDLE'            // 대기
  | 'ENTRY_PENDING'   // 진입 주문 대기
  | 'IN_POSITION'     // 포지션 보유
  | 'EXIT_PENDING'    // 청산 주문 대기
  | 'COOLDOWN'        // 쿨다운 중
  | 'HALTED';         // 킬스위치 발동

export interface DailyStats {
  readonly date: string;        // YYYY-MM-DD
  tradeCount: number;
  totalPnl: number;
  totalLoss: number;
  orderCount: number;
  orderFailCount: number;
}
