/**
 * 빗썸 REST API — endpoints 상수 + undici + jose + zod 전용.
 * 모든 URL은 endpoints.ts에서만 가져온다.
 */

import {
  PUBLIC_MARKET_ALL,
  publicCandlesMinutes,
  PUBLIC_CANDLES_DAYS,
  PUBLIC_CANDLES_WEEKS,
  PUBLIC_CANDLES_MONTHS,
  PUBLIC_TRADES_TICKS,
  PUBLIC_TICKER,
  PUBLIC_ORDERBOOK,
  PUBLIC_VIRTUAL_ASSET_WARNING,
  PRIVATE_ACCOUNTS,
  PRIVATE_ORDERS_CHANCE,
  PRIVATE_ORDER,
  PRIVATE_ORDERS,
  PRIVATE_ORDER_DELETE,
  PRIVATE_ORDERS_POST,
} from './endpoints.js';
import { requestPublicValidated, requestPrivate, requestPrivateValidated } from './client.js';
import {
  marketAllSchema,
  candlesSchema,
  tickerSchema,
  orderbookSchema,
  tradesTicksSchema,
  virtualAssetWarningSchema,
  privateStatusSchema,
  ordersChanceSchema,
  accountsResponseSchema,
} from './schemas.js';

const DEFAULT_MARKET = 'KRW-BTC';

// ─── PUBLIC ───────────────────────────────────────────────────────────────

export async function getMarketAll() {
  return requestPublicValidated(PUBLIC_MARKET_ALL, {}, marketAllSchema);
}

export async function getCandlesMinutes(unit: number, market: string = DEFAULT_MARKET, count: number = 200) {
  const path = publicCandlesMinutes(unit);
  return requestPublicValidated(path, { market, count: String(count) }, candlesSchema);
}

export async function getCandlesDays(market: string = DEFAULT_MARKET, count?: number) {
  const query: Record<string, string> = { market };
  if (count != null) query.count = String(count);
  return requestPublicValidated(PUBLIC_CANDLES_DAYS, query, candlesSchema);
}

export async function getCandlesWeeks(market: string = DEFAULT_MARKET, count?: number) {
  const query: Record<string, string> = { market };
  if (count != null) query.count = String(count);
  return requestPublicValidated(PUBLIC_CANDLES_WEEKS, query, candlesSchema);
}

export async function getCandlesMonths(market: string = DEFAULT_MARKET, count?: number) {
  const query: Record<string, string> = { market };
  if (count != null) query.count = String(count);
  return requestPublicValidated(PUBLIC_CANDLES_MONTHS, query, candlesSchema);
}

export async function getTradesTicks(market: string = DEFAULT_MARKET, count: number = 100) {
  return requestPublicValidated(PUBLIC_TRADES_TICKS, { market, count: String(count) }, tradesTicksSchema);
}

export async function getTicker(market: string = DEFAULT_MARKET) {
  return requestPublicValidated(PUBLIC_TICKER, { markets: market }, tickerSchema);
}

export async function getOrderBook(market: string = DEFAULT_MARKET) {
  return requestPublicValidated(PUBLIC_ORDERBOOK, { markets: market }, orderbookSchema);
}

export async function getVirtualAssetWarning() {
  return requestPublicValidated(PUBLIC_VIRTUAL_ASSET_WARNING, {}, virtualAssetWarningSchema);
}

// ─── PRIVATE ──────────────────────────────────────────────────────────────

export async function getAccounts() {
  return requestPrivateValidated(PRIVATE_ACCOUNTS, { method: 'GET' }, accountsResponseSchema);
}

export async function getOrdersChance(market: string = DEFAULT_MARKET) {
  return requestPrivateValidated(
    PRIVATE_ORDERS_CHANCE,
    { method: 'GET', query: { market } },
    ordersChanceSchema,
  );
}

export async function getOrder(uuid: string) {
  return requestPrivate(PRIVATE_ORDER, { method: 'GET', query: { uuid } });
}

export async function getOrders(query: { market?: string; state?: string; uuids?: string; page?: number; limit?: number }) {
  const q: Record<string, string> = {};
  if (query.market) q.market = query.market;
  if (query.state) q.state = query.state;
  if (query.uuids) q.uuids = query.uuids;
  if (query.page != null) q.page = String(query.page);
  if (query.limit != null) q.limit = String(query.limit);
  return requestPrivate(PRIVATE_ORDERS, { method: 'GET', query: q });
}

export async function cancelOrder(uuid: string) {
  return requestPrivate(PRIVATE_ORDER_DELETE, { method: 'DELETE', query: { uuid } });
}

export async function placeOrder(body: {
  market: string;
  side: 'bid' | 'ask';
  ord_type: string;
  volume?: string;
  price?: string;
}) {
  const b: Record<string, string> = {
    market: body.market,
    side: body.side,
    ord_type: body.ord_type,
  };
  if (body.volume != null) b.volume = body.volume;
  if (body.price != null) b.price = body.price;
  return requestPrivate(PRIVATE_ORDERS_POST, { method: 'POST', body: b });
}
