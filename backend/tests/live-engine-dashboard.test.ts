import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LiveEngine } from '../src/engine/live-engine.js';
import type { DashboardPosition } from '../src/dashboard-state.js';
import type { Strategy } from '../src/strategy/strategy.js';
function noopStrategy(): Strategy {
  return {
    onCandle: () => ({ action: 'HOLD' as const, reason: 'test' }),
  };
}

function mockStateMachine() {
  let state = 'IDLE';
  return {
    transition: vi.fn((to: string) => { state = to; }),
    isActive: () => state !== 'HALTED',
    isIdle: () => state === 'IDLE',
    isInPosition: () => state === 'IN_POSITION',
    get current() { return state; },
  };
}

function mockRiskManager() {
  return {
    checkEntry: () => ({ allowed: true }),
    recordOrder: vi.fn(),
    recordTrade: vi.fn(),
    getOrderFailRate: () => 0,
  };
}

function mockModeManager() {
  return {
    recordOrder: vi.fn(),
    recordTrade: vi.fn(),
  };
}

describe('LiveEngine dashboard position (setPosition)', () => {
  it('calls onPositionChange with null after syncBalance when no position', async () => {
    const onPositionChange = vi.fn<void, [DashboardPosition | null]>();
    const api = {
      getBalance: vi.fn().mockResolvedValue({
        totalKrw: 10_000_000,
        availableKrw: 10_000_000,
        totalBtc: 0,
        availableBtc: 0,
      }),
    } as unknown as import('../src/execution/bithumb-api.js').BithumbPrivateApi;

    const engine = new LiveEngine(
      noopStrategy(),
      mockStateMachine() as never,
      mockRiskManager() as never,
      api,
      {} as never,
      { isActivated: () => false } as never,
      mockModeManager() as never,
      null,
      null,
      { onPositionChange },
    );

    await engine.syncBalance();

    expect(onPositionChange).toHaveBeenCalledTimes(1);
    expect(onPositionChange).toHaveBeenCalledWith(null);
  });

  it('calls onPositionChange with position after syncBalance when balance has BTC', async () => {
    const onPositionChange = vi.fn<void, [DashboardPosition | null]>();
    const api = {
      getBalance: vi.fn().mockResolvedValue({
        totalKrw: 5_000_000,
        availableKrw: 5_000_000,
        totalBtc: 0.01,
        availableBtc: 0.01,
      }),
    } as unknown as import('../src/execution/bithumb-api.js').BithumbPrivateApi;

    const engine = new LiveEngine(
      noopStrategy(),
      mockStateMachine() as never,
      mockRiskManager() as never,
      api,
      {} as never,
      { isActivated: () => false } as never,
      mockModeManager() as never,
      null,
      null,
      { onPositionChange },
    );

    await engine.syncBalance();

    expect(onPositionChange).toHaveBeenCalledTimes(1);
    const pos = onPositionChange.mock.calls[0]![0];
    expect(pos).not.toBeNull();
    expect(pos!.status).toBe('LONG');
    expect(pos!.qty).toBe(0.01);
    expect(pos!.equity).toBe(5_000_000);
  });

  it('getPositionForDashboard returns null when positionQty is 0', () => {
    const engine = new LiveEngine(
      noopStrategy(),
      mockStateMachine() as never,
      mockRiskManager() as never,
      {} as never,
      {} as never,
      { isActivated: () => false } as never,
      mockModeManager() as never,
    );
    expect(engine.getPositionForDashboard()).toBeNull();
  });
});
