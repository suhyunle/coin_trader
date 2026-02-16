import { describe, it, expect, beforeEach } from 'vitest';
import { RiskManager } from '../src/risk/risk-manager.js';

describe('RiskManager', () => {
  let rm: RiskManager;

  beforeEach(() => {
    rm = new RiskManager();
  });

  it('should allow entry when all conditions met', () => {
    const check = rm.checkEntry({
      spread: 20,
      atr: 100_000,
      equity: 10_000_000,
    });
    expect(check.allowed).toBe(true);
  });

  it('should block when ATR too low', () => {
    const check = rm.checkEntry({
      spread: 20,
      atr: 10_000,  // below minAtrKrw=50000
      equity: 10_000_000,
    });
    expect(check.allowed).toBe(false);
    expect(check.reason).toContain('ATR');
  });

  it('should block when spread too low', () => {
    const check = rm.checkEntry({
      spread: 5,  // below minSpreadBps=10
      atr: 100_000,
      equity: 10_000_000,
    });
    expect(check.allowed).toBe(false);
    expect(check.reason).toContain('Spread');
  });

  it('should block when virtual asset warning active', () => {
    rm.setVirtualAssetWarning(true);
    const check = rm.checkEntry({
      spread: 20,
      atr: 100_000,
      equity: 10_000_000,
    });
    expect(check.allowed).toBe(false);
    expect(check.reason).toContain('Virtual asset warning');

    rm.setVirtualAssetWarning(false);
    const check2 = rm.checkEntry({
      spread: 20,
      atr: 100_000,
      equity: 10_000_000,
    });
    expect(check2.allowed).toBe(true);
  });

  it('should enforce daily trade limit', () => {
    // Record maxDailyTrades trades
    for (let i = 0; i < 10; i++) {
      rm.recordTrade(1000);
    }

    const check = rm.checkEntry({
      spread: 20,
      atr: 100_000,
      equity: 10_000_000,
      now: Date.now() + 3600_000, // past cooldown
    });
    expect(check.allowed).toBe(false);
    expect(check.reason).toContain('Daily trade limit');
  });

  it('should enforce daily loss limit', () => {
    // equity=10M, maxDailyLossPct=3% → limit=300K
    rm.recordTrade(-300_000);

    const check = rm.checkEntry({
      spread: 20,
      atr: 100_000,
      equity: 10_000_000,
      now: Date.now() + 3600_000,
    });
    expect(check.allowed).toBe(false);
    expect(check.reason).toContain('Daily loss limit');
  });

  it('should enforce cooldown', () => {
    rm.recordTrade(1000);
    const check = rm.checkEntry({
      spread: 20,
      atr: 100_000,
      equity: 10_000_000,
      now: Date.now() + 1000, // only 1 second later
    });
    expect(check.allowed).toBe(false);
    expect(check.reason).toContain('Cooldown');
  });

  it('should track order fail rate', () => {
    rm.recordOrder(true);
    rm.recordOrder(false);
    rm.recordOrder(true);
    expect(rm.getOrderFailRate()).toBeCloseTo(33.33, 0);
  });
});
