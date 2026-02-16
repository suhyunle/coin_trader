export type OrderSide = 'BUY' | 'SELL';
export type OrderType = 'MARKET' | 'LIMIT' | 'STOP';
export type OrderStatus = 'PENDING' | 'FILLED' | 'CANCELLED';

export interface Order {
  readonly id: string;
  readonly side: OrderSide;
  readonly type: OrderType;
  readonly price: number;        // limit/stop price (0 for market)
  readonly qty: number;          // KRW amount for BUY, BTC qty for SELL
  readonly createdAt: number;    // Unix ms
  status: OrderStatus;
}

export interface Fill {
  readonly orderId: string;
  readonly side: OrderSide;
  readonly price: number;        // 체결 가격
  readonly qty: number;          // BTC 수량
  readonly fee: number;          // KRW 수수료
  readonly timestamp: number;    // Unix ms
}
