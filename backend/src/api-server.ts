import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { config } from './config.js';
import { createChildLogger } from './logger.js';
import { dashboardState } from './dashboard-state.js';
import { getExchanges } from './exchanges.js';
import type { KillSwitch } from './safety/kill-switch.js';
import type { BithumbPrivateApi } from './execution/bithumb-api.js';

const log = createChildLogger('api-server');

export type ApiHandler = (req: IncomingMessage, res: ServerResponse) => Promise<void>;

/** LIVE 전용 테스트 매수 최소/기본 금액 (원) */
const TEST_ORDER_KRW_MIN = 5000;
const TEST_ORDER_KRW_MAX = 10000;
const TEST_ORDER_KRW_DEFAULT = 5000;

const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
};

/** Chrome Private Network Access: 로컬 IP(192.0.0.2 등)에서 localhost API 호출 허용 */
const corsHeadersWithPNA = {
  ...corsHeaders,
  'Access-Control-Allow-Private-Network': 'true',
};

function parseBody(req: import('node:http').IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      try {
        resolve(body ? (JSON.parse(body) as Record<string, unknown>) : {});
      } catch {
        resolve({});
      }
    });
  });
}

/**
 * API 요청 핸들러 생성 (테스트에서 KILL/포지션 등 검증용)
 */
export function createApiHandler(killSwitch?: KillSwitch | null, bithumbApi?: BithumbPrivateApi | null): ApiHandler {
  return async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const url = req.url ?? '';
    const method = req.method ?? '';

    if (method === 'OPTIONS') {
      res.writeHead(204, corsHeadersWithPNA);
      res.end();
      return;
    }

    const cors = { ...corsHeadersWithPNA };

    if (url === '/api/state' || url === '/api/state/') {
      if (method !== 'GET') {
        res.writeHead(405, cors);
        res.end(JSON.stringify({ error: 'Method not allowed' }));
        return;
      }
      const state = {
        mode: dashboardState.getMode(),
        auto: dashboardState.getAuto(),
        kill: dashboardState.getKill(),
        lastPrice: dashboardState.getLastPrice(),
        wsState: dashboardState.getWsState(),
        lastCandle: dashboardState.getLastCandle(),
        /** true면 이 서버가 LIVE로 기동되어 실거래/테스트주문 가능 */
        liveTradingAvailable: Boolean(bithumbApi),
      };
      res.writeHead(200, cors);
      res.end(JSON.stringify(state));
      return;
    }

    if (url === '/api/candles' || url === '/api/candles/') {
      if (method !== 'GET') {
        res.writeHead(405, cors);
        res.end(JSON.stringify({ error: 'Method not allowed' }));
        return;
      }
      const list = dashboardState.getCandles();
      res.writeHead(200, cors);
      res.end(JSON.stringify(list));
      return;
    }

    if ((url === '/api/events' || url === '/api/events/' || url.startsWith('/api/events?')) && method === 'GET') {
      const parsed = url.includes('?') ? new URL(url, 'http://x').searchParams : new URLSearchParams();
      const limit = Math.min(200, parseInt(parsed.get('limit') ?? '200', 10) || 200);
      const list = dashboardState.getEvents().slice(-limit);
      res.writeHead(200, cors);
      res.end(JSON.stringify(list));
      return;
    }

    // LIVE: 거래소 체결 내역 (봇 + 사용자 수동 주문 모두)
    if ((url === '/api/orders/history' || url === '/api/orders/history/' || url.startsWith('/api/orders/history?')) && method === 'GET') {
      const parsed = url.includes('?') ? new URL(url, 'http://x').searchParams : new URLSearchParams();
      const limit = Math.min(100, parseInt(parsed.get('limit') ?? '100', 10) || 100);
      if (!bithumbApi) {
        res.writeHead(200, cors);
        res.end(JSON.stringify([]));
        return;
      }
      try {
        const raw = await bithumbApi.getOrders({ state: 'done', limit });
        const list = raw.map((o, i) => {
          const r = o as unknown as Record<string, unknown>;
          const uuid = String(r['uuid'] ?? r['id'] ?? `ex-${i}`);
          const side = String(r['side'] ?? '').toLowerCase();
          const price = Number(r['price'] ?? 0);
          const vol = Number(r['executed_volume'] ?? r['volume'] ?? 0);
          const created = r['created_at'] ?? r['created_at_kst'];
          const ts = typeof created === 'string' ? new Date(created).getTime() : (Number(created) || Date.now());
          const sideLabel = side === 'bid' ? 'BUY' : 'SELL';
          const summary = `${sideLabel} ${vol.toFixed(6)} BTC @ ${price.toLocaleString()} KRW`;
          return { id: `ex-${uuid}`, ts, type: 'fill' as const, summary, detail: `거래소 ${uuid}` };
        });
        list.sort((a, b) => b.ts - a.ts);
        res.writeHead(200, cors);
        res.end(JSON.stringify(list));
      } catch (err) {
        log.warn({ err }, 'orders/history failed');
        res.writeHead(200, cors);
        res.end(JSON.stringify([]));
      }
      return;
    }

    if ((url === '/api/trades' || url === '/api/trades/') && method === 'GET') {
      const list = dashboardState.getTrades();
      res.writeHead(200, cors);
      res.end(JSON.stringify(list));
      return;
    }

    if (url === '/api/position' || url === '/api/position/') {
      if (method !== 'GET') {
        res.writeHead(405, cors);
        res.end(JSON.stringify({ error: 'Method not allowed' }));
        return;
      }
      const pos = dashboardState.getPosition();
      const lastPrice = dashboardState.getLastPrice();
      if (!pos) {
        res.writeHead(200, cors);
        res.end(JSON.stringify({
          status: 'FLAT',
          qty: 0,
          entryPrice: 0,
          stopLoss: 0,
          unrealizedPnl: 0,
          unrealizedPnlPct: 0,
          stopArmed: false,
        }));
        return;
      }
      const unrealizedPnl = lastPrice > 0 ? (lastPrice - pos.entryPrice) * pos.qty : 0;
      const unrealizedPnlPct = pos.entryPrice > 0 ? ((lastPrice - pos.entryPrice) / pos.entryPrice) * 100 : 0;
      res.writeHead(200, cors);
      res.end(JSON.stringify({
        status: 'LONG',
        qty: pos.qty,
        entryPrice: pos.entryPrice,
        stopLoss: pos.stopLoss,
        unrealizedPnl,
        unrealizedPnlPct,
        stopArmed: true,
      }));
      return;
    }

    if (url === '/api/portfolio' || url === '/api/portfolio/') {
      if (method !== 'GET') {
        res.writeHead(405, cors);
        res.end(JSON.stringify({ error: 'Method not allowed' }));
        return;
      }
      const lastPrice = dashboardState.getLastPrice();
      const lt = dashboardState.getPortfolioLongTerm();
      const st = dashboardState.getPortfolioShortTerm();
      const longTerm = lt ? {
        ...lt,
        equityKrw: lt.cashKrw + lt.btcQty * (lastPrice || lt.avgCostKrw || 0),
        unrealizedPnlKrw: lastPrice > 0 && lt.avgCostKrw > 0 ? (lastPrice - lt.avgCostKrw) * lt.btcQty : 0,
      } : null;
      const shortTerm = st ? {
        ...st,
        equityKrw: st.cashKrw + st.btcQty * (lastPrice || st.entryPriceKrw || 0),
        unrealizedPnlKrw: lastPrice > 0 && st.entryPriceKrw > 0 ? (lastPrice - st.entryPriceKrw) * st.btcQty : 0,
      } : null;
      res.writeHead(200, cors);
      res.end(JSON.stringify({ longTerm, shortTerm }));
      return;
    }

    if (url === '/api/exchanges' || url === '/api/exchanges/') {
      if (method !== 'GET') {
        res.writeHead(405, cors);
        res.end(JSON.stringify({ error: 'Method not allowed' }));
        return;
      }
      const list = getExchanges();
      res.writeHead(200, cors);
      res.end(JSON.stringify(list));
      return;
    }

    if ((url === '/api/control/mode' || url === '/api/control/mode/') && method === 'POST') {
      const body = await parseBody(req);
      const mode = typeof body.mode === 'string' ? body.mode : undefined;
      if (mode && ['BACKTEST', 'PAPER', 'LIVE'].includes(mode)) {
        dashboardState.setMode(mode);
        res.writeHead(200, cors);
        res.end(JSON.stringify({ ok: true, mode }));
      } else {
        res.writeHead(400, cors);
        res.end(JSON.stringify({ error: 'Invalid mode' }));
      }
      return;
    }

    if ((url === '/api/control/auto' || url === '/api/control/auto/') && method === 'POST') {
      const body = await parseBody(req);
      const on = typeof body.on === 'boolean' ? body.on : body.on === true;
      dashboardState.setAuto(Boolean(on));
      res.writeHead(200, cors);
      res.end(JSON.stringify({ ok: true, auto: dashboardState.getAuto() }));
      return;
    }

    if ((url === '/api/control/kill' || url === '/api/control/kill/') && method === 'POST') {
      const body = await parseBody(req);
      const wantActivate =
        body.on === true ||
        body.on === 'true' ||
        (typeof body.on === 'string' && body.on.toLowerCase() === 'true');
      log.info({ bodyOn: body.on, wantActivate }, 'Control kill request');
      if (wantActivate) {
        dashboardState.setKill(true);
        try {
          await killSwitch?.activate('Dashboard KILL');
        } catch (err) {
          log.error({ err }, 'Kill switch activate failed');
        }
        res.writeHead(200, cors);
        res.end(JSON.stringify({ ok: true, kill: true }));
        return;
      }
      // 해제: 항상 dashboardState + killSwitch 동기화 후 kill: false 반환
      dashboardState.setKill(false);
      if (killSwitch) {
        killSwitch.deactivate();
        log.info('Kill switch deactivated (resume)');
      } else {
        log.warn('Kill switch not available (no instance passed to API server)');
      }
      res.writeHead(200, cors);
      res.end(JSON.stringify({ ok: true, kill: false }));
      return;
    }

    // LIVE 전용: 소액 시장가 매수 (실거래로 눈으로 확인용) — KILL on이면 거절
    if ((url === '/api/test-order' || url === '/api/test-order/') && method === 'POST') {
      if (!bithumbApi) {
        res.writeHead(400, cors);
        res.end(JSON.stringify({
          ok: false,
          error: 'LIVE mode only',
          message: '테스트 주문은 백엔드를 LIVE 모드로 실행했을 때만 가능합니다. (터미널에서 npm run live로 재시작하세요)',
        }));
        return;
      }
      if (dashboardState.getKill() || killSwitch?.isActivated()) {
        res.writeHead(423, cors);
        res.end(JSON.stringify({
          ok: false,
          error: 'KILL_ACTIVE',
          message: '킬스위치가 켜져 있어 주문할 수 없습니다. KILL 해제 후 다시 시도하세요.',
        }));
        return;
      }
      const body = await parseBody(req);
      let krw = typeof body.krw === 'number' ? body.krw : TEST_ORDER_KRW_DEFAULT;
      krw = Math.max(TEST_ORDER_KRW_MIN, Math.min(TEST_ORDER_KRW_MAX, Math.floor(krw)));
      try {
        const result = await bithumbApi.marketBuy(krw);
        if (result.status === 'success') {
          log.info({ orderId: result.orderId, krw }, 'Test order placed (LIVE)');
          res.writeHead(200, cors);
          res.end(JSON.stringify({
            ok: true,
            orderId: result.orderId,
            krw,
            message: `${krw.toLocaleString()}원 시장가 매수 주문 접수. 거래소에서 체결 내역을 확인하세요.`,
          }));
        } else {
          res.writeHead(200, cors);
          res.end(JSON.stringify({
            ok: false,
            orderId: result.orderId || undefined,
            message: result.message || '주문 실패',
          }));
        }
      } catch (err) {
        log.error({ err, krw }, 'Test order failed');
        res.writeHead(500, cors);
        res.end(JSON.stringify({ ok: false, error: String(err), message: '테스트 주문 중 오류가 발생했습니다.' }));
      }
      return;
    }

    res.writeHead(404, cors);
    res.end(JSON.stringify({ error: 'Not found' }));
  };
}

export function startApiServer(killSwitch?: KillSwitch | null, bithumbApi?: BithumbPrivateApi | null): void {
  const server = createServer(createApiHandler(killSwitch, bithumbApi));
  const port = config.apiServerPort;
  server.listen(port, () => {
    log.info({ port }, 'Dashboard API server listening');
  });
}
