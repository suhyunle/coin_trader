import WebSocket from 'ws';
import { EventEmitter } from 'node:events';
import { createChildLogger } from '../logger.js';
import { config } from '../config.js';
import type { Tick, OrderBook, WsState } from '../types/index.js';

const log = createChildLogger('ws');

interface WsClientEvents {
  tick: [Tick];
  orderbook: [OrderBook];
  stateChange: [WsState];
  error: [Error];
}

/**
 * 빗썸 v1 Public WebSocket 클라이언트
 * wss://ws-api.bithumb.com/websocket/v1
 *
 * 구독 포맷 (JSON 배열):
 *   [{"ticket":"<uuid>"}, {"type":"trade","codes":["KRW-BTC"]}, {"type":"orderbook","codes":["KRW-BTC"]}]
 *
 * 응답:
 *   trade   → { type:"trade", code:"KRW-BTC", trade_price, trade_volume, ask_bid, trade_timestamp, ... }
 *   orderbook → { type:"orderbook", code:"KRW-BTC", orderbook_units:[{ask_price,bid_price,ask_size,bid_size}], ... }
 *
 * 연결 유지: 120초 idle timeout → 30초 간격 PING 전송
 */
export class BithumbWsClient extends EventEmitter<WsClientEvents> {
  private ws: WebSocket | null = null;
  private state: WsState = 'CLOSED';
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private pongReceived = true;
  private destroyed = false;

  private readonly url: string;
  private readonly maxReconnectDelay = 60_000;
  private readonly baseReconnectDelay = 1_000;
  private readonly heartbeatInterval = 30_000;
  private readonly market = 'KRW-BTC';

  constructor(url?: string) {
    super();
    this.url = url ?? config.bithumb.wsUrl;
  }

  connect(): void {
    if (this.destroyed) return;
    this.setState('CONNECTING');

    this.ws = new WebSocket(this.url);

    this.ws.on('open', () => {
      log.info('WebSocket connected');
      this.setState('CONNECTED');
      this.reconnectAttempts = 0;
      this.subscribe();
      this.startHeartbeat();
    });

    this.ws.on('message', (raw: WebSocket.Data) => {
      try {
        this.handleMessage(raw.toString());
      } catch (err) {
        log.error({ err }, 'Failed to parse WS message');
      }
    });

    this.ws.on('pong', () => {
      this.pongReceived = true;
    });

    this.ws.on('close', (code, reason) => {
      log.warn({ code, reason: reason.toString() }, 'WebSocket closed');
      this.cleanup();
      if (!this.destroyed) {
        this.scheduleReconnect();
      }
    });

    this.ws.on('error', (err) => {
      log.error({ err }, 'WebSocket error');
      this.emit('error', err);
    });
  }

  destroy(): void {
    this.destroyed = true;
    this.cleanup();
    if (this.ws) {
      this.ws.close(1000, 'Client shutdown');
      this.ws = null;
    }
    this.setState('CLOSED');
  }

  getState(): WsState {
    return this.state;
  }

  // ── 빗썸 v1 구독 ──────────────────────────────────────────────
  private subscribe(): void {
    const ticket = `pjt0216-${Date.now()}`;
    const msg = [
      { ticket },
      { type: 'trade', codes: [this.market], isOnlyRealtime: true },
      { type: 'orderbook', codes: [this.market], isOnlyRealtime: true },
    ];
    this.send(msg);
    log.info({ market: this.market, ticket }, 'Subscribed (v1 format)');
  }

  private send(data: unknown): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  // ── 메시지 핸들링 ──────────────────────────────────────────────
  private handleMessage(raw: string): void {
    const msg = JSON.parse(raw) as Record<string, unknown>;

    // 구독 확인 응답 (status 필드 포함) — 무시
    if (msg['status'] !== undefined) return;

    const type = msg['type'] as string | undefined;

    if (type === 'trade') {
      this.handleTrade(msg);
    } else if (type === 'orderbook') {
      this.handleOrderbook(msg);
    }
  }

  /**
   * trade 메시지 파싱
   * {
   *   type: "trade", code: "KRW-BTC",
   *   trade_price: 101834000, trade_volume: 0.00098,
   *   ask_bid: "BID"|"ASK", trade_timestamp: 1771239847731,
   *   sequential_id: 17712074767490000, stream_type: "REALTIME"
   * }
   */
  private handleTrade(msg: Record<string, unknown>): void {
    const price = msg['trade_price'] as number | undefined;
    const volume = msg['trade_volume'] as number | undefined;
    const askBid = msg['ask_bid'] as string | undefined;
    const tradeTs = msg['trade_timestamp'] as number | undefined;

    if (!price || !volume || price <= 0 || volume <= 0) return;

    const tick: Tick = {
      symbol: (msg['code'] as string) ?? this.market,
      price,
      volume,
      timestamp: tradeTs ?? Date.now(),
      side: askBid === 'BID' ? 'BUY' : 'SELL',
    };

    this.emit('tick', tick);
  }

  /**
   * orderbook 메시지 파싱
   * {
   *   type: "orderbook", code: "KRW-BTC",
   *   total_ask_size, total_bid_size,
   *   orderbook_units: [{ ask_price, bid_price, ask_size, bid_size }, ...],
   *   timestamp: 1771207467004, stream_type: "REALTIME"
   * }
   */
  private handleOrderbook(msg: Record<string, unknown>): void {
    const units = msg['orderbook_units'] as Array<Record<string, number>> | undefined;
    if (!units || units.length === 0) return;

    const bids: Array<{ price: number; qty: number }> = [];
    const asks: Array<{ price: number; qty: number }> = [];

    for (const u of units) {
      const askPrice = u['ask_price'];
      const bidPrice = u['bid_price'];
      const askSize = u['ask_size'];
      const bidSize = u['bid_size'];
      if (askPrice != null && askSize != null) {
        asks.push({ price: askPrice, qty: askSize });
      }
      if (bidPrice != null && bidSize != null) {
        bids.push({ price: bidPrice, qty: bidSize });
      }
    }

    const ob: OrderBook = {
      symbol: (msg['code'] as string) ?? this.market,
      bids: bids.sort((a, b) => b.price - a.price),
      asks: asks.sort((a, b) => a.price - b.price),
      timestamp: (msg['timestamp'] as number) ?? Date.now(),
    };
    this.emit('orderbook', ob);
  }

  // ── Heartbeat (30초 PING) ─────────────────────────────────────
  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.pongReceived = true;

    this.heartbeatTimer = setInterval(() => {
      if (!this.pongReceived) {
        log.warn('Pong not received, reconnecting');
        this.ws?.terminate();
        return;
      }
      this.pongReceived = false;
      this.ws?.ping();
    }, this.heartbeatInterval);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  // ── 재연결 (지수 백오프) ──────────────────────────────────────
  private scheduleReconnect(): void {
    this.setState('RECONNECTING');
    const delay = Math.min(
      this.baseReconnectDelay * Math.pow(2, this.reconnectAttempts),
      this.maxReconnectDelay,
    );
    this.reconnectAttempts++;

    log.info({ delay, attempt: this.reconnectAttempts }, 'Scheduling reconnect');

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, delay);
  }

  private cleanup(): void {
    this.stopHeartbeat();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private setState(state: WsState): void {
    if (this.state !== state) {
      this.state = state;
      this.emit('stateChange', state);
    }
  }
}
