export interface Position {
  entryPrice: number;
  qty: number;             // BTC 수량
  entryTime: number;       // Unix ms
  stopLoss: number;        // SL 가격
  trailingStop: number;    // 트레일링 스톱 가격
  highWaterMark: number;   // 진입 후 최고가
}
