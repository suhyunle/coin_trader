import { createChildLogger } from '../logger.js';
import { config, type TradingMode } from '../config.js';
import { AuditLog } from '../safety/audit-log.js';

const log = createChildLogger('mode');

export interface ModeStats {
  startTime: number;
  tradeCount: number;
  totalPnl: number;
  grossProfit: number;
  grossLoss: number;
  maxDrawdownPct: number;
  peakEquity: number;
  orderCount: number;
  orderFailCount: number;
}

/**
 * 모드 매니저 — BACKTEST / PAPER / LIVE 전환
 *
 * PAPER 진입: 백테스트 OOS에서 PF>1.2, MDD<20%, trades>100 (설정 가능)
 * LIVE 진입: PAPER에서 최소 2주(200 트레이드), PF/MDD 충족, 주문 실패율 <1%
 */
export class ModeManager {
  private mode: TradingMode;
  private stats: ModeStats;
  private readonly audit: AuditLog;

  constructor(audit: AuditLog, initialMode?: TradingMode) {
    this.audit = audit;
    this.mode = initialMode ?? config.mode;
    this.stats = this.newStats();
    log.info({ mode: this.mode }, 'Mode initialized');
  }

  get current(): TradingMode {
    return this.mode;
  }

  /**
   * PAPER 진입 자격 확인 (백테스트 OOS 결과 기준)
   */
  checkPaperEligibility(oos: {
    profitFactor: number;
    maxDrawdownPct: number;
    tradeCount: number;
  }): { eligible: boolean; reasons: string[] } {
    const reasons: string[] = [];

    if (oos.profitFactor < config.promotion.paperMinPf) {
      reasons.push(`PF ${oos.profitFactor.toFixed(2)} < ${config.promotion.paperMinPf}`);
    }
    if (oos.maxDrawdownPct > config.promotion.paperMaxMddPct) {
      reasons.push(`MDD ${oos.maxDrawdownPct.toFixed(1)}% > ${config.promotion.paperMaxMddPct}%`);
    }
    if (oos.tradeCount < config.promotion.paperMinTrades) {
      reasons.push(`Trades ${oos.tradeCount} < ${config.promotion.paperMinTrades}`);
    }

    return { eligible: reasons.length === 0, reasons };
  }

  /**
   * LIVE 진입 자격 확인 (PAPER 실적 기준)
   */
  checkLiveEligibility(): { eligible: boolean; reasons: string[] } {
    const reasons: string[] = [];
    const elapsed = Date.now() - this.stats.startTime;
    const elapsedDays = elapsed / (24 * 3600 * 1000);

    if (elapsedDays < config.promotion.paperMinDays) {
      reasons.push(`Paper days ${elapsedDays.toFixed(1)} < ${config.promotion.paperMinDays}`);
    }

    if (this.stats.tradeCount < config.promotion.paperMinTrades) {
      reasons.push(`Trades ${this.stats.tradeCount} < ${config.promotion.paperMinTrades}`);
    }

    const pf = this.stats.grossLoss > 0
      ? this.stats.grossProfit / Math.abs(this.stats.grossLoss)
      : this.stats.grossProfit > 0 ? Infinity : 0;
    if (pf < config.promotion.paperMinPf) {
      reasons.push(`PF ${pf.toFixed(2)} < ${config.promotion.paperMinPf}`);
    }

    if (this.stats.maxDrawdownPct > config.promotion.paperMaxMddPct) {
      reasons.push(`MDD ${this.stats.maxDrawdownPct.toFixed(1)}% > ${config.promotion.paperMaxMddPct}%`);
    }

    const failRate = this.stats.orderCount > 0
      ? (this.stats.orderFailCount / this.stats.orderCount) * 100
      : 0;
    if (failRate > config.promotion.paperMaxOrderFailPct) {
      reasons.push(`Order fail rate ${failRate.toFixed(1)}% > ${config.promotion.paperMaxOrderFailPct}%`);
    }

    return { eligible: reasons.length === 0, reasons };
  }

  /**
   * 모드 전환 (수동)
   */
  switchMode(to: TradingMode): void {
    const from = this.mode;

    // LIVE 진입 시 자격 확인
    if (to === 'LIVE' && from === 'PAPER') {
      const check = this.checkLiveEligibility();
      if (!check.eligible) {
        log.warn({ reasons: check.reasons }, 'LIVE promotion denied');
        throw new Error(`Cannot promote to LIVE: ${check.reasons.join('; ')}`);
      }
    }

    log.info({ from, to }, 'Mode switch');
    this.audit.info('mode', 'MODE_SWITCH', `${from} → ${to}`, to);
    this.mode = to;
    this.stats = this.newStats();
  }

  /**
   * 트레이드 기록 (PF/MDD 추적용)
   */
  recordTrade(pnl: number, equity: number): void {
    this.stats.tradeCount++;
    this.stats.totalPnl += pnl;

    if (pnl > 0) {
      this.stats.grossProfit += pnl;
    } else {
      this.stats.grossLoss += pnl;
    }

    if (equity > this.stats.peakEquity) {
      this.stats.peakEquity = equity;
    }
    const dd = this.stats.peakEquity > 0
      ? ((this.stats.peakEquity - equity) / this.stats.peakEquity) * 100
      : 0;
    if (dd > this.stats.maxDrawdownPct) {
      this.stats.maxDrawdownPct = dd;
    }
  }

  recordOrder(success: boolean): void {
    this.stats.orderCount++;
    if (!success) this.stats.orderFailCount++;
  }

  getStats(): Readonly<ModeStats> {
    return { ...this.stats };
  }

  private newStats(): ModeStats {
    return {
      startTime: Date.now(),
      tradeCount: 0,
      totalPnl: 0,
      grossProfit: 0,
      grossLoss: 0,
      maxDrawdownPct: 0,
      peakEquity: config.capital.initialKrw,
      orderCount: 0,
      orderFailCount: 0,
    };
  }
}
