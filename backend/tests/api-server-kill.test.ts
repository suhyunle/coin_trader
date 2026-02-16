import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createApiHandler } from '../src/api-server.js';
import { dashboardState } from '../src/dashboard-state.js';
import type { IncomingMessage, ServerResponse } from 'node:http';

function mockReq(overrides: Partial<IncomingMessage> = {}): IncomingMessage {
  const req = {
    url: '/api/test-order',
    method: 'POST',
    on: (event: string, cb: () => void) => {
      if (event === 'end') setImmediate(cb);
    },
    ...overrides,
  } as unknown as IncomingMessage;
  return req;
}

function mockRes(): { res: ServerResponse; writeHead: ReturnType<typeof vi.fn>; end: ReturnType<typeof vi.fn> } {
  const writeHead = vi.fn();
  const end = vi.fn();
  const res = {
    writeHead,
    end,
  } as unknown as ServerResponse;
  return { res, writeHead, end };
}

describe('API server: KILL blocks test-order', () => {
  beforeEach(() => {
    dashboardState.setKill(false);
  });

  afterEach(() => {
    dashboardState.setKill(false);
  });

  it('returns 423 when KILL is on (dashboardState.getKill())', async () => {
    dashboardState.setKill(true);
    const killSwitch = { isActivated: vi.fn().mockReturnValue(true), activate: vi.fn(), deactivate: vi.fn() };
    const bithumbApi = { marketBuy: vi.fn() } as unknown as import('../src/execution/bithumb-api.js').BithumbPrivateApi;
    const handler = createApiHandler(killSwitch, bithumbApi);

    const req = mockReq();
    const { res, writeHead, end } = mockRes();

    await handler(req, res);

    expect(writeHead).toHaveBeenCalledWith(423, expect.any(Object));
    expect(end).toHaveBeenCalledWith(expect.stringContaining('KILL_ACTIVE'));
    expect(bithumbApi.marketBuy).not.toHaveBeenCalled();
  });

  it('returns 423 when killSwitch.isActivated() is true', async () => {
    dashboardState.setKill(false);
    const killSwitch = { isActivated: vi.fn().mockReturnValue(true), activate: vi.fn(), deactivate: vi.fn() };
    const bithumbApi = { marketBuy: vi.fn() } as unknown as import('../src/execution/bithumb-api.js').BithumbPrivateApi;
    const handler = createApiHandler(killSwitch, bithumbApi);

    const req = mockReq();
    const { res, writeHead, end } = mockRes();

    await handler(req, res);

    expect(writeHead).toHaveBeenCalledWith(423, expect.any(Object));
    expect(bithumbApi.marketBuy).not.toHaveBeenCalled();
  });

  it('proceeds to marketBuy when KILL is off and bithumbApi provided', async () => {
    dashboardState.setKill(false);
    const killSwitch = { isActivated: vi.fn().mockReturnValue(false), activate: vi.fn(), deactivate: vi.fn() };
    const bithumbApi = {
      marketBuy: vi.fn().mockResolvedValue({ orderId: 'test-uuid', status: 'success' as const }),
    } as unknown as import('../src/execution/bithumb-api.js').BithumbPrivateApi;
    const handler = createApiHandler(killSwitch, bithumbApi);

    const req = mockReq();
    const { res, writeHead, end } = mockRes();

    await handler(req, res);

    expect(writeHead).toHaveBeenCalledWith(200, expect.any(Object));
    expect(bithumbApi.marketBuy).toHaveBeenCalled();
  });
});
