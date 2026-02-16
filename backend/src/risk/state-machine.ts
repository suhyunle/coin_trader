import { createChildLogger } from '../logger.js';
import type { TradingState } from '../types/index.js';

const log = createChildLogger('state-machine');

type StateTransition = [TradingState, TradingState];

/** 허용된 상태 전이 */
const VALID_TRANSITIONS: StateTransition[] = [
  ['IDLE', 'ENTRY_PENDING'],
  ['ENTRY_PENDING', 'IN_POSITION'],
  ['ENTRY_PENDING', 'IDLE'],           // 주문 실패/취소
  ['IN_POSITION', 'EXIT_PENDING'],
  ['IN_POSITION', 'IDLE'],             // 스톱 히트 (즉시 청산)
  ['EXIT_PENDING', 'IDLE'],
  ['EXIT_PENDING', 'COOLDOWN'],
  ['IN_POSITION', 'COOLDOWN'],         // 스톱 히트 후 쿨다운
  ['COOLDOWN', 'IDLE'],
  // 킬스위치: 어디서든 HALTED로
  ['IDLE', 'HALTED'],
  ['ENTRY_PENDING', 'HALTED'],
  ['IN_POSITION', 'HALTED'],
  ['EXIT_PENDING', 'HALTED'],
  ['COOLDOWN', 'HALTED'],
  // HALTED 해제는 IDLE로만
  ['HALTED', 'IDLE'],
];

/**
 * 트레이딩 상태 머신
 * 잘못된 전이 시도 시 에러 (안전장치)
 */
export class TradingStateMachine {
  private state: TradingState = 'IDLE';
  private stateEnteredAt: number = Date.now();
  private history: Array<{ from: TradingState; to: TradingState; at: number }> = [];

  get current(): TradingState {
    return this.state;
  }

  get stateAge(): number {
    return Date.now() - this.stateEnteredAt;
  }

  transition(to: TradingState): void {
    if (this.state === to) return; // noop

    const valid = VALID_TRANSITIONS.some(([from, target]) => from === this.state && target === to);
    if (!valid) {
      const msg = `Invalid state transition: ${this.state} → ${to}`;
      log.error({ from: this.state, to }, msg);
      throw new Error(msg);
    }

    log.info({ from: this.state, to }, 'State transition');
    this.history.push({ from: this.state, to, at: Date.now() });
    this.state = to;
    this.stateEnteredAt = Date.now();

    // 히스토리 100개 제한
    if (this.history.length > 100) {
      this.history = this.history.slice(-50);
    }
  }

  canTransition(to: TradingState): boolean {
    return VALID_TRANSITIONS.some(([from, target]) => from === this.state && target === to);
  }

  isActive(): boolean {
    return this.state !== 'HALTED';
  }

  isIdle(): boolean {
    return this.state === 'IDLE';
  }

  isInPosition(): boolean {
    return this.state === 'IN_POSITION';
  }

  getHistory(): ReadonlyArray<{ from: TradingState; to: TradingState; at: number }> {
    return this.history;
  }

  reset(): void {
    this.state = 'IDLE';
    this.stateEnteredAt = Date.now();
    this.history = [];
  }
}
