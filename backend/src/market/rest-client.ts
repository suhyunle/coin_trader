import { createChildLogger } from '../logger.js';
import type { Candle, Tick, OrderBook, OrderBookEntry } from '../types/index.js';
import * as bithumb from '../exchange/bithumb/rest.js';

const log = createChildLogger('rest-public');

/**
 * 빗썸 v1 Public REST API — 모든 URL은 exchange/bithumb/endpoints.ts 상수만 사용.
 * undici + zod 검증 + 재시도는 exchange/bithumb/client에서 처리.
 */
export class BithumbPublicRest {
  private readonly market = 'KRW-BTC';

  async getMarkets(): Promise<Array<{ market: string; korean_name: string; english_name: string }>> {
    try {
      return await bithumb.getMarketAll();
    } catch (err) {
      log.warn({ err }, 'getMarketAll failed');
      return [];
    }
  }

  async getTicker(): Promise<TickerResponse | null> {
    try {
      const data = await bithumb.getTicker(this.market);
      if (!data || data.length === 0) return null;
      const t = data[0]!;
      return {
        market: t.market,
        tradePrice: t.trade_price,
        openingPrice: t.opening_price,
        highPrice: t.high_price,
        lowPrice: t.low_price,
        prevClosingPrice: t.prev_closing_price,
        change: t.change,
        changePrice: t.signed_change_price,
        changeRate: t.signed_change_rate,
        accTradeVolume24h: t.acc_trade_volume_24h,
        accTradePrice24h: t.acc_trade_price_24h,
        timestamp: t.timestamp,
      };
    } catch (err) {
      log.warn({ err }, 'getTicker failed');
      return null;
    }
  }

  async getCandles(count: number = 200): Promise<Candle[]> {
    try {
      const data = await bithumb.getCandlesMinutes(5, this.market, count);
      if (!data) return [];
      return data.map((c) => ({
        timestamp: new Date(c.candle_date_time_utc + 'Z').getTime(),
        open: c.opening_price,
        high: c.high_price,
        low: c.low_price,
        close: c.trade_price,
        volume: c.candle_acc_trade_volume,
      })).reverse();
    } catch (err) {
      log.warn({ err }, 'getCandles failed');
      return [];
    }
  }

  async getOrderBook(): Promise<OrderBook | null> {
    try {
      const data = await bithumb.getOrderBook(this.market);
      if (!data || data.length === 0) return null;
      const ob = data[0]!;
      const bids: OrderBookEntry[] = [];
      const asks: OrderBookEntry[] = [];
      for (const unit of ob.orderbook_units) {
        asks.push({ price: unit.ask_price, qty: unit.ask_size });
        bids.push({ price: unit.bid_price, qty: unit.bid_size });
      }
      return {
        symbol: this.market,
        bids: bids.sort((a, b) => b.price - a.price),
        asks: asks.sort((a, b) => a.price - b.price),
        timestamp: ob.timestamp,
      };
    } catch (err) {
      log.warn({ err }, 'getOrderBook failed');
      return null;
    }
  }

  async getRecentTrades(count: number = 100): Promise<Tick[]> {
    try {
      const data = await bithumb.getTradesTicks(this.market, count);
      if (!data) return [];
      return data.map((t) => ({
        symbol: this.market,
        price: t.trade_price,
        volume: t.trade_volume,
        timestamp: t.timestamp,
        side: t.ask_bid === 'BID' ? 'BUY' as const : 'SELL' as const,
      }));
    } catch (err) {
      log.warn({ err }, 'getRecentTrades failed');
      return [];
    }
  }

  async getVirtualAssetWarning(): Promise<boolean> {
    try {
      const raw = await bithumb.getVirtualAssetWarning();
      const list = Array.isArray(raw) ? raw : (raw as { data?: string[] }).data;
      if (!Array.isArray(list)) return false;
      return list.some((m: string) => m === this.market || m === 'KRW-BTC');
    } catch (err) {
      log.debug({ err }, 'getVirtualAssetWarning failed');
      return false;
    }
  }
}

export interface TickerResponse {
  market: string;
  tradePrice: number;
  openingPrice: number;
  highPrice: number;
  lowPrice: number;
  prevClosingPrice: number;
  change: 'RISE' | 'EVEN' | 'FALL';
  changePrice: number;
  changeRate: number;
  accTradeVolume24h: number;
  accTradePrice24h: number;
  timestamp: number;
}
