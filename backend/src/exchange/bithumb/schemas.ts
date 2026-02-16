import { z } from 'zod';

// ─── PUBLIC 응답 ───────────────────────────────────────────────────────────

export const marketAllItemSchema = z.object({
  market: z.string(),
  korean_name: z.string(),
  english_name: z.string(),
});
export const marketAllSchema = z.array(marketAllItemSchema);

export const candleSchema = z.object({
  market: z.string(),
  candle_date_time_utc: z.string(),
  candle_date_time_kst: z.string().optional(),
  opening_price: z.number(),
  high_price: z.number(),
  low_price: z.number(),
  trade_price: z.number(),
  timestamp: z.number().optional(),
  candle_acc_trade_price: z.number().optional(),
  candle_acc_trade_volume: z.number(),
  unit: z.number().optional(),
});
export const candlesSchema = z.array(candleSchema);

export const tickerItemSchema = z.object({
  market: z.string(),
  trade_price: z.number(),
  opening_price: z.number(),
  high_price: z.number(),
  low_price: z.number(),
  prev_closing_price: z.number(),
  change: z.enum(['RISE', 'EVEN', 'FALL']),
  signed_change_price: z.number(),
  signed_change_rate: z.number(),
  acc_trade_volume_24h: z.number(),
  acc_trade_price_24h: z.number(),
  timestamp: z.number(),
});
export const tickerSchema = z.array(tickerItemSchema);

export const orderbookUnitSchema = z.object({
  ask_price: z.number(),
  bid_price: z.number(),
  ask_size: z.number(),
  bid_size: z.number(),
});
export const orderbookItemSchema = z.object({
  market: z.string(),
  timestamp: z.number(),
  total_ask_size: z.number().optional(),
  total_bid_size: z.number().optional(),
  orderbook_units: z.array(orderbookUnitSchema),
});
export const orderbookSchema = z.array(orderbookItemSchema);

export const tradeTickSchema = z.object({
  market: z.string(),
  trade_date_utc: z.string().optional(),
  trade_time_utc: z.string().optional(),
  timestamp: z.number(),
  trade_price: z.number(),
  trade_volume: z.number(),
  ask_bid: z.enum(['ASK', 'BID']),
});
export const tradesTicksSchema = z.array(tradeTickSchema);

/** 경보제: 배열 또는 { data: string[] } 등 */
export const virtualAssetWarningSchema = z.union([
  z.array(z.string()),
  z.object({ data: z.array(z.string()).optional() }),
]);

// ─── PRIVATE 응답 (공통 status) ───────────────────────────────────────────

export const privateStatusSchema = z.object({
  status: z.string(),
  message: z.string().optional(),
  data: z.unknown().optional(),
});

/** GET /v1/accounts 응답: 계정별 잔고 배열 */
export const accountItemSchema = z.object({
  currency: z.string(),
  balance: z.string(),
  locked: z.string(),
  avg_buy_price: z.string().optional(),
  avg_buy_price_modified: z.boolean().optional(),
  unit_currency: z.string().optional(),
});
export const accountsResponseSchema = z.array(accountItemSchema);

export const accountsSchema = privateStatusSchema.and(
  z.object({
    data: z
      .object({
        total_krw: z.string().optional(),
        available_krw: z.string().optional(),
        total_btc: z.string().optional(),
        available_btc: z.string().optional(),
      })
      .optional(),
  }),
);

export const ordersChanceMarketSchema = z.object({
  id: z.string().optional(),
  name: z.string().optional(),
  state: z.string().optional(),
  bid: z.object({ currency: z.string(), price_unit: z.string(), min_total: z.string() }).optional(),
  ask: z.object({ currency: z.string(), price_unit: z.string(), min_total: z.string() }).optional(),
  max_total: z.string().optional(),
});
export const ordersChanceSchema = privateStatusSchema.and(
  z.object({
    bid_fee: z.string().optional(),
    ask_fee: z.string().optional(),
    market: ordersChanceMarketSchema.optional(),
    bid_account: z
      .object({
        currency: z.string(),
        balance: z.string(),
        locked: z.string(),
        unit_currency: z.string().optional(),
      })
      .optional(),
    ask_account: z
      .object({
        currency: z.string(),
        balance: z.string(),
        locked: z.string(),
        unit_currency: z.string().optional(),
      })
      .optional(),
  }),
);

export const orderSchema = privateStatusSchema;
export const ordersListSchema = privateStatusSchema;
export const orderDeleteSchema = privateStatusSchema;
export const ordersPostSchema = privateStatusSchema;
