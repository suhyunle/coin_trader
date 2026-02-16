import { config } from '../config.js';
import { createChildLogger } from '../logger.js';
import { portfolioTracker } from '../portfolio-tracker.js';
import { getDipBuyAmount } from '../strategy/strategyA_DCA.js';

const log = createChildLogger('dca-runner');

const feeRate = config.execution.feeRate;

/**
 * DCA 실행 (PAPER: 포트폴리오만 갱신, LIVE: 추후 API 연동)
 */
export function executeDcaBuy(amountKrw: number, priceKrw: number): boolean {
  const lt = portfolioTracker.getLongTerm();
  if (lt.cashKrw < amountKrw) {
    log.warn({ cash: lt.cashKrw, need: amountKrw }, 'DCA skipped: insufficient cash');
    return false;
  }
  const btc = amountKrw / priceKrw;
  const fee = btc * priceKrw * feeRate;
  const totalKrw = amountKrw + fee;
  if (lt.cashKrw < totalKrw) return false;

  portfolioTracker.applyDcaBuy(totalKrw, btc, priceKrw);
  log.info({ amountKrw, btc, priceKrw, fee }, 'DCA buy executed');
  return true;
}

/**
 * 정기 DCA 실행 (스케줄러 콜백용)
 */
export function runScheduledDca(amountKrw: number, priceKrw: number): void {
  if (amountKrw <= 0) return;
  executeDcaBuy(amountKrw, priceKrw);
}

/**
 * 급락 DCA: 30일 고가 대비 -X% 이하일 때, 쿨다운 체크 후 실행
 */
export function runDipDca(currentPrice: number, high30d: number): void {
  const lt = portfolioTracker.getLongTerm();
  const amount = getDipBuyAmount(currentPrice, high30d, lt);
  if (amount <= 0) return;
  if (executeDcaBuy(amount, currentPrice)) {
    portfolioTracker.setLastDipBuyAt(Date.now());
  }
}
