import { createChildLogger } from '../logger.js';
import { AuditLog } from './audit-log.js';
import { TradingStateMachine } from '../risk/state-machine.js';
import type { BithumbPrivateApi } from '../execution/bithumb-api.js';

const log = createChildLogger('kill-switch');

/**
 * 킬스위치
 * - 즉시 AUTO OFF (상태 → HALTED)
 * - 신규 주문 금지
 * - 옵션: 포지션 시장가 청산
 */
export class KillSwitch {
  private activated = false;
  private activatedAt: number | null = null;
  private readonly audit: AuditLog;
  private readonly stateMachine: TradingStateMachine;
  private readonly api: BithumbPrivateApi | null;

  constructor(
    stateMachine: TradingStateMachine,
    audit: AuditLog,
    api?: BithumbPrivateApi,
  ) {
    this.stateMachine = stateMachine;
    this.audit = audit;
    this.api = api ?? null;
  }

  /**
   * 킬스위치 발동
   * @param reason 발동 사유
   * @param liquidate true이면 보유 포지션 시장가 청산 시도
   */
  async activate(reason: string, liquidate: boolean = false): Promise<void> {
    if (this.activated) {
      log.warn('Kill switch already activated');
      return;
    }

    this.activated = true;
    this.activatedAt = Date.now();

    log.error({ reason, liquidate }, 'KILL SWITCH ACTIVATED');
    this.audit.critical('kill-switch', 'ACTIVATED', reason);

    // 상태머신 → HALTED
    try {
      this.stateMachine.transition('HALTED');
    } catch {
      // 이미 HALTED이면 무시
    }

    // 포지션 청산 (옵션)
    if (liquidate && this.api) {
      try {
        const balance = await this.api.getBalance();
        if (balance.availableBtc > 0.00001) {
          log.warn({ btc: balance.availableBtc }, 'Liquidating position');
          const result = await this.api.marketSell(balance.availableBtc);
          this.audit.critical(
            'kill-switch',
            'LIQUIDATION',
            `Sold ${balance.availableBtc} BTC: ${result.status}`,
          );
        }
      } catch (err) {
        log.error({ err }, 'Failed to liquidate');
        this.audit.critical('kill-switch', 'LIQUIDATION_FAILED', String(err));
      }
    }
  }

  /**
   * 킬스위치 해제 (수동)
   */
  deactivate(): void {
    if (!this.activated) return;

    this.activated = false;
    log.info('Kill switch deactivated');
    this.audit.info('kill-switch', 'DEACTIVATED');

    try {
      this.stateMachine.transition('IDLE');
    } catch {
      // HALTED → IDLE이 유효하지 않으면 무시
    }
  }

  isActivated(): boolean {
    return this.activated;
  }

  getActivatedAt(): number | null {
    return this.activatedAt;
  }
}
