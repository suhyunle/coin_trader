import { describe, it, expect, vi } from 'vitest';
import { waitForFill } from '../src/execution/order-poller.js';
import type { BithumbPrivateApi, BithumbOrderInfo } from '../src/execution/bithumb-api.js';

function mockApi(responses: Array<BithumbOrderInfo | null>): BithumbPrivateApi {
  let callIndex = 0;
  return {
    getOrder: vi.fn(async () => {
      const res = responses[Math.min(callIndex, responses.length - 1)] ?? null;
      callIndex++;
      return res;
    }),
  } as unknown as BithumbPrivateApi;
}

function makeOrder(status: string, filledQty: number = 0.001): BithumbOrderInfo {
  return {
    orderId: 'test-uuid',
    side: 'bid',
    type: 'price',
    price: 100_000_000,
    qty: 0.001,
    status,
    filledQty,
  };
}

describe('waitForFill', () => {
  it('returns filled=true when order status is done', async () => {
    const api = mockApi([makeOrder('wait'), makeOrder('done', 0.001)]);
    const result = await waitForFill(api, 'test-uuid', 5000);
    expect(result.filled).toBe(true);
    expect(result.filledQty).toBe(0.001);
    expect(result.status).toBe('done');
  });

  it('returns filled=false when order is cancelled', async () => {
    const api = mockApi([makeOrder('cancel', 0)]);
    const result = await waitForFill(api, 'test-uuid', 5000);
    expect(result.filled).toBe(false);
    expect(result.status).toBe('cancel');
  });

  it('returns filled=false on timeout', async () => {
    const api = mockApi([makeOrder('wait'), makeOrder('wait'), makeOrder('wait')]);
    const result = await waitForFill(api, 'test-uuid', 800);
    expect(result.filled).toBe(false);
  });

  it('handles getOrder returning null', async () => {
    const api = mockApi([null, null, makeOrder('done', 0.001)]);
    const result = await waitForFill(api, 'test-uuid', 10000);
    expect(result.filled).toBe(true);
  });

  it('handles getOrder throwing errors', async () => {
    let calls = 0;
    const api = {
      getOrder: vi.fn(async () => {
        calls++;
        if (calls <= 2) throw new Error('network error');
        return makeOrder('done', 0.001);
      }),
    } as unknown as BithumbPrivateApi;

    const result = await waitForFill(api, 'test-uuid', 10000);
    expect(result.filled).toBe(true);
  });
});
