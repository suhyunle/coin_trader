import { createChildLogger } from '../logger.js';
import type { BithumbPrivateApi, BithumbOrderInfo } from './bithumb-api.js';

const log = createChildLogger('order-poller');

export interface FillResult {
  filled: boolean;
  filledQty: number;
  status: string;
}

/** 폴링 간격 백오프 단계 (ms) */
const POLL_INTERVALS = [500, 1000, 2000];

/**
 * 주문 체결 확인 폴링
 * - api.getOrder(uuid) 반복 호출
 * - 빗썸 v1 상태: wait(대기), watch(예약대기), done(완료), cancel(취소)
 * - 폴링 간격: 500ms → 1s → 2s 백오프
 */
export async function waitForFill(
  api: BithumbPrivateApi,
  orderId: string,
  timeoutMs: number = 30_000,
): Promise<FillResult> {
  const deadline = Date.now() + timeoutMs;
  let attempt = 0;

  while (Date.now() < deadline) {
    const interval = POLL_INTERVALS[Math.min(attempt, POLL_INTERVALS.length - 1)]!;
    await sleep(interval);
    attempt++;

    let order: BithumbOrderInfo | null;
    try {
      order = await api.getOrder(orderId);
    } catch (err) {
      log.warn({ err, orderId, attempt }, 'Poll getOrder failed');
      continue;
    }

    if (!order) {
      log.debug({ orderId, attempt }, 'Order not found yet');
      continue;
    }

    log.debug({ orderId, status: order.status, filledQty: order.filledQty, attempt }, 'Poll result');

    if (order.status === 'done') {
      return { filled: true, filledQty: order.filledQty, status: 'done' };
    }
    if (order.status === 'cancel') {
      return { filled: false, filledQty: order.filledQty, status: 'cancel' };
    }
    // wait, watch → 계속 폴링
  }

  log.warn({ orderId, timeoutMs }, 'Order fill polling timed out');
  // 타임아웃 시 마지막 상태 한번 더 확인
  try {
    const lastCheck = await api.getOrder(orderId);
    if (lastCheck) {
      return {
        filled: lastCheck.status === 'done',
        filledQty: lastCheck.filledQty,
        status: lastCheck.status,
      };
    }
  } catch {
    // ignore
  }

  return { filled: false, filledQty: 0, status: 'timeout' };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
