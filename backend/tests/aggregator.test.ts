import { describe, it, expect } from 'vitest';
import { CandleAggregator } from '../src/candles/aggregator.js';
import type { Candle, Tick } from '../src/types/index.js';

function makeTick(price: number, volume: number, timestamp: number): Tick {
  return { symbol: 'BTC_KRW', price, volume, timestamp, side: 'BUY' };
}

describe('CandleAggregator', () => {
  it('should aggregate ticks into candle', () => {
    const candles: Candle[] = [];
    const agg = new CandleAggregator((c) => candles.push(c));

    // All within same 5-min window: [0, 300000)
    agg.feed(makeTick(100, 1, 0));        // open
    agg.feed(makeTick(120, 2, 60000));    // high
    agg.feed(makeTick(80, 1, 120000));    // low
    agg.feed(makeTick(110, 3, 240000));   // close

    // Trigger close by feeding tick in next window
    agg.feed(makeTick(115, 1, 300000));
    expect(candles).toHaveLength(1);
    expect(candles[0]!.open).toBe(100);
    expect(candles[0]!.high).toBe(120);
    expect(candles[0]!.low).toBe(80);
    expect(candles[0]!.close).toBe(110);
    expect(candles[0]!.volume).toBe(7);   // 1+2+1+3
    expect(candles[0]!.timestamp).toBe(0); // window start
  });

  it('should drop stale ticks', () => {
    const candles: Candle[] = [];
    const agg = new CandleAggregator((c) => candles.push(c));

    agg.feed(makeTick(100, 1, 300000));  // window [300000, 600000)
    agg.feed(makeTick(90, 1, 100000));   // before current window → drop

    const stats = agg.getStats();
    expect(stats.tickCount).toBe(1);
    expect(stats.droppedCount).toBe(1);
  });

  it('should flush on demand', () => {
    const candles: Candle[] = [];
    const agg = new CandleAggregator((c) => candles.push(c));

    agg.feed(makeTick(100, 1, 0));
    agg.feed(makeTick(120, 2, 60000));

    const flushed = agg.flush();
    expect(flushed).not.toBeNull();
    expect(flushed!.open).toBe(100);
    expect(flushed!.high).toBe(120);
    expect(candles).toHaveLength(1);
  });

  it('should flushIfExpired correctly', () => {
    const candles: Candle[] = [];
    const agg = new CandleAggregator((c) => candles.push(c));

    agg.feed(makeTick(100, 1, 0));

    // Not expired yet
    const r1 = agg.flushIfExpired(200000);
    expect(r1).toBeNull();

    // Expired
    const r2 = agg.flushIfExpired(300001);
    expect(r2).not.toBeNull();
    expect(candles).toHaveLength(1);
  });
});
