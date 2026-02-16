import { createServer } from 'node:http';
import { config } from './config.js';
import { createChildLogger } from './logger.js';
import { dashboardState } from './dashboard-state.js';
import { getExchanges } from './exchanges.js';

const log = createChildLogger('api-server');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
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

export function startApiServer(): void {
  const server = createServer(async (req, res) => {
    const url = req.url ?? '';
    const method = req.method ?? '';

    if (method === 'OPTIONS') {
      res.writeHead(204, corsHeaders);
      res.end();
      return;
    }

    const cors = { ...corsHeaders };

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
      dashboardState.setKill(true);
      res.writeHead(200, cors);
      res.end(JSON.stringify({ ok: true, kill: true }));
      return;
    }

    res.writeHead(404, cors);
    res.end(JSON.stringify({ error: 'Not found' }));
  });

  const port = config.apiServerPort;
  server.listen(port, () => {
    log.info({ port }, 'Dashboard API server listening');
  });
}
