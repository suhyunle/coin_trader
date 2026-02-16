import { config } from '../config.js';
import type { LongTermSlice } from '../types/portfolio.js';

const cfg = config.strategyA_DCA;

/**
 * 전략 A: 장기 DCA
 * - 정기 DCA: 스케줄에서 호출 (매월/매주)
 * - 급락 DCA: 캔들/가격 기반으로 호출
 * 매도 로직 없음 (장기 보유)
 */
export interface DCAStrategyResult {
  /** 오늘 정기 DCA 실행할 금액 (0이면 스킵) */
  scheduledAmountKRW: number;
  /** 급락 추가 매수할 금액 (0이면 스킵) */
  dipAmountKRW: number;
}

/**
 * 오늘이 정기 DCA 일자인지, 실행할 금액 반환
 */
export function getScheduledDcaAmount(today: Date): number {
  if (cfg.weeklyDay >= 0 && cfg.weeklyDay <= 6) {
    if (today.getDay() === cfg.weeklyDay) return cfg.monthlyAmountKRW;
  }
  if (today.getDate() === Math.min(cfg.monthlyDay, 28)) return cfg.monthlyAmountKRW;
  return 0;
}

/**
 * 급락 조건: 최근 N일 고가 대비 -X% 이하
 * 쿨다운: dipCooldownDays 내 1회만
 */
export function getDipBuyAmount(
  currentPrice: number,
  high30d: number,
  slice: Readonly<LongTermSlice>,
): number {
  if (high30d <= 0) return 0;
  const pctDrop = ((high30d - currentPrice) / high30d) * 100;
  if (pctDrop < cfg.dipThresholdPct) return 0;

  const cooldownMs = cfg.dipCooldownDays * 24 * 60 * 60 * 1000;
  if (slice.lastDipBuyAt > 0 && Date.now() - slice.lastDipBuyAt < cooldownMs) return 0;

  if (slice.cashKrw < cfg.dipBuyKRW) return 0;
  return cfg.dipBuyKRW;
}

/** DCA 전략 설정 요약 (리포트/대시보드용) */
export function getDcaStrategySummary(): { monthlyAmountKRW: number; dipBuyKRW: number; monthlyDay: number } {
  return {
    monthlyAmountKRW: cfg.monthlyAmountKRW,
    dipBuyKRW: cfg.dipBuyKRW,
    monthlyDay: cfg.monthlyDay,
  };
}
