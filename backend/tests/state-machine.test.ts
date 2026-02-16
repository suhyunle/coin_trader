import { describe, it, expect } from 'vitest';
import { TradingStateMachine } from '../src/risk/state-machine.js';

describe('TradingStateMachine', () => {
  it('should start in IDLE', () => {
    const sm = new TradingStateMachine();
    expect(sm.current).toBe('IDLE');
    expect(sm.isIdle()).toBe(true);
    expect(sm.isActive()).toBe(true);
  });

  it('should allow valid transitions', () => {
    const sm = new TradingStateMachine();
    sm.transition('ENTRY_PENDING');
    expect(sm.current).toBe('ENTRY_PENDING');

    sm.transition('IN_POSITION');
    expect(sm.current).toBe('IN_POSITION');
    expect(sm.isInPosition()).toBe(true);

    sm.transition('EXIT_PENDING');
    sm.transition('IDLE');
    expect(sm.isIdle()).toBe(true);
  });

  it('should throw on invalid transitions', () => {
    const sm = new TradingStateMachine();
    expect(() => sm.transition('IN_POSITION')).toThrow('Invalid state transition');
    expect(() => sm.transition('EXIT_PENDING')).toThrow('Invalid state transition');
  });

  it('should allow HALTED from any active state', () => {
    const sm = new TradingStateMachine();
    sm.transition('ENTRY_PENDING');
    sm.transition('HALTED');
    expect(sm.isActive()).toBe(false);
    expect(sm.current).toBe('HALTED');
  });

  it('should allow HALTED → IDLE (kill switch reset)', () => {
    const sm = new TradingStateMachine();
    sm.transition('HALTED');
    sm.transition('IDLE');
    expect(sm.isActive()).toBe(true);
  });

  it('should record history', () => {
    const sm = new TradingStateMachine();
    sm.transition('ENTRY_PENDING');
    sm.transition('IN_POSITION');
    sm.transition('HALTED');

    const h = sm.getHistory();
    expect(h).toHaveLength(3);
    expect(h[0]!.from).toBe('IDLE');
    expect(h[0]!.to).toBe('ENTRY_PENDING');
  });

  it('should noop on same-state transition', () => {
    const sm = new TradingStateMachine();
    sm.transition('IDLE'); // noop
    expect(sm.getHistory()).toHaveLength(0);
  });

  it('should support cooldown path', () => {
    const sm = new TradingStateMachine();
    sm.transition('ENTRY_PENDING');
    sm.transition('IN_POSITION');
    sm.transition('COOLDOWN');
    expect(sm.current).toBe('COOLDOWN');
    sm.transition('IDLE');
    expect(sm.isIdle()).toBe(true);
  });
});
