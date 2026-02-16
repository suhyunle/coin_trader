import { describe, it, expect, vi, beforeEach } from 'vitest';

// config를 먼저 mock (모듈 로딩 전)
vi.mock('../src/config.js', () => ({
  config: {
    telegram: { enabled: true, botToken: 'test-token', chatId: '12345' },
    log: { level: 'silent' },
  },
}));

// fetch mock
const fetchMock = vi.fn().mockResolvedValue({ ok: true });
vi.stubGlobal('fetch', fetchMock);

const { Notifier } = await import('../src/notification/notifier.js');

describe('Notifier', () => {
  beforeEach(() => {
    fetchMock.mockClear();
  });

  it('sends entry notification via Telegram', async () => {
    const n = new Notifier();
    n.notifyEntry(100_000_000, 0.001, 98_000_000);

    // 큐 처리를 위한 대기
    await new Promise((r) => setTimeout(r, 600));

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, opts] = fetchMock.mock.calls[0]!;
    expect(url).toContain('test-token');
    expect(url).toContain('sendMessage');
    const body = JSON.parse(opts.body);
    expect(body.chat_id).toBe('12345');
    expect(body.text).toContain('매수 체결');
  });

  it('sends exit notification with PnL', async () => {
    const n = new Notifier();
    n.notifyExit(101_000_000, 0.001, 50_000, 'SIGNAL');

    await new Promise((r) => setTimeout(r, 600));

    expect(fetchMock).toHaveBeenCalledOnce();
    const body = JSON.parse(fetchMock.mock.calls[0]![1].body);
    expect(body.text).toContain('매도 체결');
    expect(body.text).toContain('SIGNAL');
  });

  it('sends kill switch notification', async () => {
    const n = new Notifier();
    n.notifyKillSwitch('test reason');

    await new Promise((r) => setTimeout(r, 600));

    const body = JSON.parse(fetchMock.mock.calls[0]![1].body);
    expect(body.text).toContain('킬스위치');
    expect(body.text).toContain('test reason');
  });

  it('does not crash on fetch failure', async () => {
    fetchMock.mockRejectedValueOnce(new Error('network'));
    const n = new Notifier();
    n.notifyError('test', 'some error');

    await new Promise((r) => setTimeout(r, 600));
    // no throw
  });

  it('sends WS state notifications', async () => {
    const n = new Notifier();
    n.notifyWsState('RECONNECTING');

    await new Promise((r) => setTimeout(r, 600));

    const body = JSON.parse(fetchMock.mock.calls[0]![1].body);
    expect(body.text).toContain('연결 끊김');
  });

  it('rate limits to 1 message per second', async () => {
    const n = new Notifier();
    n.notifyStartup('PAPER');
    n.notifyEntry(100_000_000, 0.001, 98_000_000);

    // 첫 메시지 즉시, 두번째는 1초 후
    await new Promise((r) => setTimeout(r, 600));
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await new Promise((r) => setTimeout(r, 1200));
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
