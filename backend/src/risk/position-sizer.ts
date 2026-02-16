import { config } from '../config.js';
import type { PositionSizing } from '../types/index.js';

/**
 * ATR 기반 포지션 사이징 (롱전용)
 *
 * 리스크 금액 = 자본 × riskPerTradePct
 * BTC 수량 = 리스크 금액 / (ATR × atrStopMultiplier)
 * KRW 금액 = BTC 수량 × 진입가
 * maxPositionKrw 상한 적용
 */
export function calcPositionSize(
  equity: number,
  entryPrice: number,
  atr: number,
  atrStopMultiplier: number = config.strategy.atrStopMultiplier,
): PositionSizing {
  const riskKrw = equity * config.risk.riskPerTradePct;
  const stopDistance = atr * atrStopMultiplier;
  const stopLoss = entryPrice - stopDistance;

  // 리스크 금액 기반 BTC 수량
  let qty = stopDistance > 0 ? riskKrw / stopDistance : 0;
  let krwAmount = qty * entryPrice;

  // 상한 적용
  if (krwAmount > config.risk.maxPositionKrw) {
    krwAmount = config.risk.maxPositionKrw;
    qty = krwAmount / entryPrice;
  }

  // equity 초과 방지
  if (krwAmount > equity * 0.95) {
    krwAmount = equity * 0.95;
    qty = krwAmount / entryPrice;
  }

  return {
    qty: roundBtc(qty),
    krwAmount: Math.floor(krwAmount),
    riskKrw: Math.floor(riskKrw),
    stopLoss: Math.floor(stopLoss),
  };
}

/** BTC 소수점 8자리 반올림 */
function roundBtc(v: number): number {
  return Math.floor(v * 1e8) / 1e8;
}
