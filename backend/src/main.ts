import { config, type TradingMode } from './config.js';
import { createChildLogger } from './logger.js';
import { getDb, closeDb } from './db/database.js';
import { BithumbWsClient } from './market/ws-client.js';
import { BithumbPublicRest } from './market/rest-client.js';
import { CandleAggregator } from './candles/aggregator.js';
import { CandleStore } from './candles/store.js';
import { DonchianBreakout } from './strategy/donchian-breakout.js';
import { TradingStateMachine } from './risk/state-machine.js';
import { RiskManager } from './risk/risk-manager.js';
import { AuditLog } from './safety/audit-log.js';
import { KillSwitch } from './safety/kill-switch.js';
import { ModeManager } from './mode/mode-manager.js';
import { PaperEngine } from './engine/paper-engine.js';
import { LiveEngine } from './engine/live-engine.js';
import { BithumbPrivateApi } from './execution/bithumb-api.js';
import { dashboardState } from './dashboard-state.js';
import { startApiServer } from './api-server.js';
import { convertToTimelineDto } from './dashboard-events.js';
import { buildTradeLog } from './report/trade-log.js';
import type { Candle } from './types/index.js';

const log = createChildLogger('main');

// ── CLI 인자 파싱 ──
function parseMode(): TradingMode {
  const idx = process.argv.indexOf('--mode');
  if (idx !== -1 && process.argv[idx + 1]) {
    const m = process.argv[idx + 1]!.toUpperCase();
    if (m === 'PAPER' || m === 'LIVE' || m === 'BACKTEST') return m;
  }
  return config.mode;
}

async function main(): Promise<void> {
  const mode = parseMode();
  log.info({ mode, version: '0.2.0' }, 'Starting trading bot');

  // ── DB 초기화 ──
  getDb();

  // ── 공용 컴포넌트 ──
  const audit = new AuditLog();
  const stateMachine = new TradingStateMachine();
  const riskMgr = new RiskManager();
  const modeMgr = new ModeManager(audit, mode);

  const strategy = new DonchianBreakout({
    donchianPeriod: config.strategy.donchianPeriod,
    atrPeriod: config.strategy.atrPeriod,
    atrStopMultiplier: config.strategy.atrStopMultiplier,
    emaFilterPeriod: config.strategy.emaFilterPeriod,
  });

  // ── 데이터 레이어 ──
  const candleStore = new CandleStore();
  const restClient = new BithumbPublicRest();
  const wsClient = new BithumbWsClient();

  // ── 엔진 선택 ──
  let paperEngine: PaperEngine | null = null;
  let liveEngine: LiveEngine | null = null;
  let killSwitch: KillSwitch;

  if (mode === 'LIVE') {
    if (!config.bithumb.accessKey || !config.bithumb.secretKey) {
      log.error('Bithumb API keys required for LIVE mode');
      process.exit(1);
    }
    const api = new BithumbPrivateApi();
    killSwitch = new KillSwitch(stateMachine, audit, api);
    liveEngine = new LiveEngine(
      strategy, stateMachine, riskMgr, api, audit, killSwitch, modeMgr, restClient,
    );
    // 초기 잔고 동기화
    await liveEngine.syncBalance();
  } else {
    killSwitch = new KillSwitch(stateMachine, audit);
    paperEngine = new PaperEngine(
      strategy, stateMachine, riskMgr, audit, modeMgr,
      () => dashboardState.getAuto(),
    );
  }

  audit.info('main', 'BOT_STARTED', `mode=${mode}`);
  dashboardState.setMode(mode);
  if (paperEngine) dashboardState.setPosition(null);

  // ── 가상자산 투자 경고 (기동 시 1회, 이후 30분마다 갱신) ──
  const updateVirtualAssetWarning = async (): Promise<void> => {
    try {
      const active = await restClient.getVirtualAssetWarning();
      riskMgr.setVirtualAssetWarning(active);
      if (active) log.warn('Virtual asset warning active — new entries blocked');
    } catch (err) {
      log.debug({ err }, 'Virtual asset warning fetch failed (assuming inactive)');
      riskMgr.setVirtualAssetWarning(false);
    }
  };
  await updateVirtualAssetWarning();

  // ── 기동 시 REST 캔들로 히스토리 + 인디케이터 워밍업 ──
  const restCandles = await restClient.getCandles(200);
  if (restCandles.length > 0) {
    candleStore.upsertBatch(restCandles);
    const warmupBars = Math.min(60, restCandles.length); // Donchian(20)+EMA(50) 여유
    const warmupCandles = candleStore.getLatest(warmupBars);
    if (warmupCandles.length > 0) {
      paperEngine?.warmup(warmupCandles);
      liveEngine?.warmup(warmupCandles);
      dashboardState.setCandles(candleStore.getLatest(200));
      const last = warmupCandles[warmupCandles.length - 1];
      if (last) dashboardState.setLastPrice(last.close);
      log.info({ bars: warmupCandles.length }, 'Engine warmup from REST candles');
    }
  }

  // ── 캔들 집계 → 엔진 연결 ──
  const aggregator = new CandleAggregator((candle: Candle) => {
    candleStore.upsert(candle);
    dashboardState.setLastCandle(candle);
    dashboardState.setCandles(candleStore.getLatest(200));
    log.debug({
      ts: candle.timestamp,
      o: candle.open,
      h: candle.high,
      l: candle.low,
      c: candle.close,
      v: candle.volume,
    }, 'Candle closed');

    if (paperEngine) {
      paperEngine.onCandle(candle);
      const eventLog = paperEngine.getEventLog();
      dashboardState.setEvents(convertToTimelineDto(eventLog));
      dashboardState.setTrades(buildTradeLog(eventLog, 0));
      const pos = paperEngine.getPosition();
      dashboardState.setPosition(pos ? {
        status: 'LONG' as const,
        qty: pos.qty,
        entryPrice: pos.entryPrice,
        stopLoss: pos.stopLoss,
        trailingStop: pos.trailingStop,
        entryTime: pos.entryTime,
        equity: paperEngine!.getEquity(),
      } : null);
    }
    if (liveEngine) {
      liveEngine.onCandle(candle).catch((err) => {
        log.error({ err }, 'Live engine error');
        killSwitch.activate('Live engine unhandled error').catch(() => {});
      });
    }
  });

  // ── WebSocket 이벤트 ──
  wsClient.on('tick', (tick) => {
    dashboardState.setLastPrice(tick.price);
    aggregator.feed(tick);
  });

  wsClient.on('orderbook', (ob) => {
    paperEngine?.onOrderBook(ob);
    liveEngine?.onOrderBook(ob);
  });

  wsClient.on('stateChange', (state) => {
    dashboardState.setWsState(state);
    log.info({ wsState: state }, 'WebSocket state changed');
    audit.info('ws', 'STATE_CHANGE', state);
    if (state === 'CONNECTED') {
      setTimeout(() => {
        restClient.getOrderBook().then((ob) => {
          if (ob) {
            paperEngine?.onOrderBook(ob);
            liveEngine?.onOrderBook(ob);
            log.debug('Orderbook snapshot after WS connect');
          }
        }).catch((err) => log.debug({ err }, 'Orderbook snapshot failed'));
      }, 2000);
    }
  });

  wsClient.on('error', (err) => {
    log.error({ err }, 'WebSocket error');
  });

  // ── 주기적 작업 ──

  // 5분마다 봉 강제 마감 체크
  const flushTimer = setInterval(() => {
    aggregator.flushIfExpired(Date.now());
  }, 10_000);

  // 30분마다 REST 정합성 체크 + 가상자산 경고 갱신
  const reconcileTimer = setInterval(async () => {
    try {
      const restCandles = await restClient.getCandles(200);
      if (restCandles.length > 0) {
        const fixed = candleStore.reconcile(restCandles);
        if (fixed > 0) {
          audit.info('reconcile', 'FIXED', `${fixed} candles corrected`);
        }
      }
      await updateVirtualAssetWarning();
    } catch (err) {
      log.error({ err }, 'Reconciliation failed');
    }
  }, 30 * 60 * 1000);

  // LIVE: 5분마다 잔고 동기화
  let balanceSyncTimer: ReturnType<typeof setInterval> | null = null;
  if (liveEngine) {
    balanceSyncTimer = setInterval(() => {
      liveEngine!.syncBalance().catch((err) => {
        log.error({ err }, 'Balance sync failed');
      });
    }, 5 * 60 * 1000);
  }

  // ── WebSocket 연결 시작 ──
  wsClient.connect();

  // ── 대시보드 API (프론트 폴링용) ──
  startApiServer();

  // ── Graceful shutdown ──
  const shutdown = async (signal: string) => {
    log.info({ signal }, 'Shutting down');
    audit.info('main', 'SHUTDOWN', signal);

    wsClient.destroy();
    clearInterval(flushTimer);
    clearInterval(reconcileTimer);
    if (balanceSyncTimer) clearInterval(balanceSyncTimer);

    // 남은 봉 저장
    aggregator.flush();

    closeDb();
    log.info('Shutdown complete');
    process.exit(0);
  };

  process.on('SIGINT', () => { shutdown('SIGINT').catch(() => process.exit(1)); });
  process.on('SIGTERM', () => { shutdown('SIGTERM').catch(() => process.exit(1)); });

  // ── STDIN 킬스위치 (k + Enter) ──
  if (process.stdin.isTTY) {
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.on('data', (data) => {
      const key = data.toString();
      if (key === 'k' || key === 'K') {
        log.warn('Manual kill switch triggered');
        killSwitch.activate('Manual kill (keyboard)').catch(() => {});
      }
      if (key === 'r' || key === 'R') {
        log.info('Manual kill switch reset');
        killSwitch.deactivate();
      }
      if (key === 'q' || key === '\u0003') { // q or Ctrl+C
        shutdown('keyboard').catch(() => process.exit(1));
      }
    });

    console.log('');
    console.log(`  Mode: ${mode}`);
    console.log('  Keys: [k] Kill switch  [r] Reset  [q] Quit');
    console.log('');
  }

  log.info('Bot running. Waiting for market data...');
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
