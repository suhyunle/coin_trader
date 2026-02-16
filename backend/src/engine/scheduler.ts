import cron from 'node-cron';
import { createChildLogger } from '../logger.js';
import { getScheduledDcaAmount } from '../strategy/strategyA_DCA.js';

const log = createChildLogger('scheduler');

export type OnScheduledDca = (amountKrw: number) => void | Promise<void>;

/**
 * 정기 DCA 스케줄
 * 매일 09:00 KST(00:00 UTC)에 체크하여 오늘이 DCA 일이면 콜백 호출
 */
export function startDcaSchedule(onScheduledDca: OnScheduledDca): void {
  // 매일 00:00 UTC = 09:00 KST
  cron.schedule('0 0 * * *', () => {
    const now = new Date();
    const amount = getScheduledDcaAmount(now);
    if (amount <= 0) return;
    log.info({ amount, date: now.toISOString().slice(0, 10) }, 'Scheduled DCA trigger');
    Promise.resolve(onScheduledDca(amount)).catch((err) => {
      log.error({ err }, 'Scheduled DCA callback error');
    });
  });
  log.info('DCA scheduler started (daily 00:00 UTC)');
}
