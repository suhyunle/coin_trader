import { config } from '../config.js';
import { createChildLogger } from '../logger.js';
import type { RiskCheck, DailyStats } from '../types/index.js';

const log = createChildLogger('risk');

/**
 * 리스크 매니저
 * - 일일 손실 제한
 * - 일일 트레이드 수 제한
 * - 쿨다운
 * - 스프레드 필터
 * - 변동성(ATR) 필터
 */
export class RiskManager {
  private dailyStats: DailyStats;
  private lastTradeTime: number = 0;
  /** 가상자산 투자 경고 구간이면 신규 진입 차단 */
  private virtualAssetWarningActive: boolean = false;

  constructor() {
    this.dailyStats = this.newDayStats();
  }

  setVirtualAssetWarning(active: boolean): void {
    this.virtualAssetWarningActive = active;
  }

  isVirtualAssetWarningActive(): boolean {
    return this.virtualAssetWarningActive;
  }

  /**
   * 진입 가능 여부 체크 (모든 필터 적용)
   */
  checkEntry(params: {
    spread: number;        // 현재 스프레드 (bps)
    atr: number;           // 현재 ATR
    equity: number;        // 현재 자본
    now?: number;
  }): RiskCheck {
    const now = params.now ?? Date.now();
    this.rollDay(now);

    if (this.virtualAssetWarningActive) {
      return { allowed: false, reason: 'Virtual asset warning active (no new entries)' };
    }

    // 일일 손실 제한
    const maxDailyLoss = params.equity * config.risk.maxDailyLossPct;
    if (Math.abs(this.dailyStats.totalLoss) >= maxDailyLoss) {
      log.warn({ loss: this.dailyStats.totalLoss, limit: maxDailyLoss }, 'Daily loss limit');
      return { allowed: false, reason: `Daily loss limit reached: ${this.dailyStats.totalLoss.toFixed(0)} KRW` };
    }

    // 일일 트레이드 수 제한
    if (this.dailyStats.tradeCount >= config.risk.maxDailyTrades) {
      return { allowed: false, reason: `Daily trade limit: ${this.dailyStats.tradeCount}/${config.risk.maxDailyTrades}` };
    }

    // 쿨다운
    const cooldownMs = config.risk.cooldownMinutes * 60 * 1000;
    if (now - this.lastTradeTime < cooldownMs) {
      const remaining = Math.ceil((cooldownMs - (now - this.lastTradeTime)) / 60000);
      return { allowed: false, reason: `Cooldown: ${remaining}min remaining` };
    }

    // 스프레드 필터
    if (params.spread < config.risk.minSpreadBps) {
      return { allowed: false, reason: `Spread too low: ${params.spread.toFixed(1)} < ${config.risk.minSpreadBps} bps` };
    }

    // 변동성(ATR) 필터
    if (params.atr < config.risk.minAtrKrw) {
      return { allowed: false, reason: `ATR too low: ${params.atr.toFixed(0)} < ${config.risk.minAtrKrw} KRW` };
    }

    return { allowed: true };
  }

  recordTrade(pnl: number, now?: number): void {
    const ts = now ?? Date.now();
    this.rollDay(ts);

    this.dailyStats.tradeCount++;
    this.dailyStats.totalPnl += pnl;
    if (pnl < 0) {
      this.dailyStats.totalLoss += pnl;
    }
    this.lastTradeTime = ts;
  }

  recordOrder(success: boolean): void {
    this.dailyStats.orderCount++;
    if (!success) {
      this.dailyStats.orderFailCount++;
    }
  }

  getDailyStats(): Readonly<DailyStats> {
    return { ...this.dailyStats };
  }

  getOrderFailRate(): number {
    if (this.dailyStats.orderCount === 0) return 0;
    return (this.dailyStats.orderFailCount / this.dailyStats.orderCount) * 100;
  }

  reset(): void {
    this.dailyStats = this.newDayStats();
    this.lastTradeTime = 0;
  }

  private rollDay(now: number): void {
    const today = new Date(now).toISOString().slice(0, 10);
    if (this.dailyStats.date !== today) {
      // 하루 끝 시점: 전일 리포트 (PnL, 트레이드 수) 자동 로그
      log.info(
        {
          dailyReport: true,
          date: this.dailyStats.date,
          tradeCount: this.dailyStats.tradeCount,
          totalPnl: this.dailyStats.totalPnl,
          totalLoss: this.dailyStats.totalLoss,
        },
        'Daily report',
      );
      this.dailyStats = this.newDayStats(today);
    }
  }

  private newDayStats(date?: string): DailyStats {
    return {
      date: date ?? new Date().toISOString().slice(0, 10),
      tradeCount: 0,
      totalPnl: 0,
      totalLoss: 0,
      orderCount: 0,
      orderFailCount: 0,
    };
  }
}
