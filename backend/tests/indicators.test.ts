import { describe, it, expect } from 'vitest';
import { ATR } from '../src/indicators/atr.js';
import { DonchianChannel } from '../src/indicators/donchian.js';
import { EMA } from '../src/indicators/ema.js';
import type { Candle } from '../src/types/index.js';

function makeCandle(o: number, h: number, l: number, c: number, ts = 0): Candle {
  return { timestamp: ts, open: o, high: h, low: l, close: c, volume: 1 };
}

describe('ATR', () => {
  it('should compute ATR with Wilder smoothing', () => {
    const atr = new ATR(3);
    // Period 3: first 3 bars → SMA of TR, then Wilder
    atr.update(makeCandle(100, 110, 90, 105));  // TR=20 (no prev close)
    expect(atr.isReady).toBe(false);

    atr.update(makeCandle(105, 115, 95, 110));  // TR=max(20, |115-105|, |95-105|)=20
    expect(atr.isReady).toBe(false);

    atr.update(makeCandle(110, 120, 100, 115)); // TR=max(20, |120-110|, |100-110|)=20
    expect(atr.isReady).toBe(true);
    expect(atr.value).toBeCloseTo(20, 5); // SMA(20,20,20) = 20

    // Wilder: (2*20 + 10) / 3 = 16.67
    atr.update(makeCandle(115, 120, 110, 118)); // TR=max(10, |120-115|, |110-115|)=10
    expect(atr.value).toBeCloseTo(50/3, 5);
  });

  it('should reset properly', () => {
    const atr = new ATR(2);
    atr.update(makeCandle(100, 110, 90, 105));
    atr.update(makeCandle(105, 115, 95, 110));
    expect(atr.isReady).toBe(true);
    atr.reset();
    expect(atr.isReady).toBe(false);
    expect(atr.value).toBe(0);
  });
});

describe('DonchianChannel', () => {
  it('should track highest high and lowest low', () => {
    const dc = new DonchianChannel(3);
    dc.update(makeCandle(100, 110, 90, 100));
    dc.update(makeCandle(100, 115, 85, 100));
    const ch = dc.update(makeCandle(100, 105, 95, 100));

    expect(dc.isReady).toBe(true);
    expect(ch.upper).toBe(115);
    expect(ch.lower).toBe(85);
    expect(ch.middle).toBe(100);
  });

  it('should slide window', () => {
    const dc = new DonchianChannel(2);
    dc.update(makeCandle(100, 200, 50, 100));  // h=200, l=50
    dc.update(makeCandle(100, 120, 80, 100));  // h=120, l=80
    expect(dc.upper).toBe(200);
    expect(dc.lower).toBe(50);

    dc.update(makeCandle(100, 110, 90, 100));  // window: [120,80], [110,90]
    expect(dc.upper).toBe(120);
    expect(dc.lower).toBe(80);
  });
});

describe('EMA', () => {
  it('should compute EMA correctly', () => {
    const ema = new EMA(3);
    ema.update(10);
    ema.update(20);
    const v = ema.update(30); // SMA seed = 20
    expect(ema.isReady).toBe(true);
    expect(v).toBeCloseTo(20, 5);

    // EMA = (40 - 20) * 0.5 + 20 = 30
    const v2 = ema.update(40);
    expect(v2).toBeCloseTo(30, 5);
  });
});
