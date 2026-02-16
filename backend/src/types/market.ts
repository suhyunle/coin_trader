/** 빗썸 WebSocket 틱 데이터 */
export interface Tick {
  readonly symbol: string;
  readonly price: number;
  readonly volume: number;
  readonly timestamp: number;       // Unix ms
  readonly side: 'BUY' | 'SELL';
}

/** 빗썸 WebSocket 호가 데이터 */
export interface OrderBook {
  readonly symbol: string;
  readonly bids: OrderBookEntry[];
  readonly asks: OrderBookEntry[];
  readonly timestamp: number;
}

export interface OrderBookEntry {
  readonly price: number;
  readonly qty: number;
}

/** WebSocket 연결 상태 */
export type WsState = 'CONNECTING' | 'CONNECTED' | 'RECONNECTING' | 'CLOSED';

/** 빗썸 REST 캔들 */
export interface BithumbCandle {
  readonly timestamp: number;
  readonly open: number;
  readonly high: number;
  readonly low: number;
  readonly close: number;
  readonly volume: number;
}
