import type { Candle, Order, Fill } from '../types/index.js';

export interface FillModelConfig {
  readonly feeRate: number;        // 0.0005 = 0.05%
  readonly slippageBps: number;    // 기본 슬리피지 bps (예: 5 = 0.05%)
}

const DEFAULT_CONFIG: FillModelConfig = {
  feeRate: 0.0005,
  slippageBps: 5,
};

/**
 * 시장가/지정가/스톱 체결 시뮬레이션
 */
export class FillModel {
  private readonly config: FillModelConfig;

  constructor(config?: Partial<FillModelConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 봉 내에서 체결 가능 여부 확인 및 Fill 생성
   * 시장가: 다음 봉 open에 슬리피지 적용
   * 지정가: 봉 high/low 범위 내 체결
   * 스톱: 봉이 스톱 가격을 관통하면 체결
   */
  tryFill(order: Order, candle: Candle): Fill | null {
    switch (order.type) {
      case 'MARKET':
        return this.fillMarket(order, candle);
      case 'LIMIT':
        return this.fillLimit(order, candle);
      case 'STOP':
        return this.fillStop(order, candle);
    }
  }

  private fillMarket(order: Order, candle: Candle): Fill {
    const slippage = candle.open * (this.config.slippageBps / 10000);
    const price = order.side === 'BUY'
      ? candle.open + slippage
      : candle.open - slippage;

    return this.createFill(order, price, candle.timestamp);
  }

  private fillLimit(order: Order, candle: Candle): Fill | null {
    if (order.side === 'BUY') {
      // 매수 지정가: 봉 저점이 주문가 이하
      if (candle.low <= order.price) {
        const price = Math.min(order.price, candle.open);
        return this.createFill(order, price, candle.timestamp);
      }
    } else {
      // 매도 지정가: 봉 고점이 주문가 이상
      if (candle.high >= order.price) {
        const price = Math.max(order.price, candle.open);
        return this.createFill(order, price, candle.timestamp);
      }
    }
    return null;
  }

  private fillStop(order: Order, candle: Candle): Fill | null {
    if (order.side === 'SELL') {
      // 매도 스톱: 가격이 스톱 가격 이하로 하락
      if (candle.low <= order.price) {
        // 갭 다운: open이 이미 스톱 이하면 open에 체결
        const slippage = candle.open * (this.config.slippageBps / 10000);
        const price = candle.open <= order.price
          ? candle.open - slippage
          : order.price - slippage;
        return this.createFill(order, Math.max(price, candle.low), candle.timestamp);
      }
    } else {
      // 매수 스톱: 가격이 스톱 가격 이상으로 상승
      if (candle.high >= order.price) {
        const slippage = candle.open * (this.config.slippageBps / 10000);
        const price = candle.open >= order.price
          ? candle.open + slippage
          : order.price + slippage;
        return this.createFill(order, Math.min(price, candle.high), candle.timestamp);
      }
    }
    return null;
  }

  private createFill(order: Order, price: number, timestamp: number): Fill {
    const qty = order.side === 'BUY'
      ? order.qty / price   // KRW → BTC 수량 변환
      : order.qty;           // BTC 수량 그대로
    const fee = qty * price * this.config.feeRate;

    return {
      orderId: order.id,
      side: order.side,
      price,
      qty,
      fee,
      timestamp,
    };
  }
}
