import type { TradingEvent } from './types/index.js';
import type { TimelineEventDto } from './dashboard-state.js';

/**
 * 엔진 이벤트 로그 → 대시보드 타임라인 DTO
 */
export function convertToTimelineDto(log: readonly TradingEvent[]): TimelineEventDto[] {
  const out: TimelineEventDto[] = [];
  let id = 0;
  for (const e of log) {
    id += 1;
    let item: TimelineEventDto = { id: `ev-${id}`, ts: e.timestamp, type: 'log', summary: '' };
    switch (e.type) {
      case 'SIGNAL':
        item = { id: `ev-${id}`, ts: e.timestamp, type: 'signal', summary: e.signal.action, detail: e.signal.reason };
        break;
      case 'ORDER_CREATED':
        item = { id: `ev-${id}`, ts: e.timestamp, type: 'order', summary: `${e.order.side} ${e.order.qty} @ ${e.order.price || 'MARKET'}`, detail: `Order ${e.order.id}` };
        break;
      case 'ORDER_FILLED':
        item = { id: `ev-${id}`, ts: e.timestamp, type: 'fill', summary: `FILL ${e.fill.side} ${e.fill.qty.toFixed(6)} BTC @ ${e.fill.price.toLocaleString()}`, detail: `Order ${e.fill.orderId}` };
        break;
      case 'POSITION_OPENED':
        item = { id: `ev-${id}`, ts: e.timestamp, type: 'order', summary: `LONG 진입 ${e.position.qty.toFixed(6)} BTC @ ${e.position.entryPrice.toLocaleString()}`, detail: `Entry ${e.position.entryPrice.toLocaleString()} KRW` };
        break;
      case 'POSITION_CLOSED':
        item = { id: `ev-${id}`, ts: e.timestamp, type: 'fill', summary: `청산 ${e.qty.toFixed(6)} BTC @ ${e.exitPrice.toLocaleString()} PnL ${e.pnl >= 0 ? '+' : ''}${e.pnl.toLocaleString()} KRW`, detail: `Exit ${e.exitPrice.toLocaleString()} (${e.pnlPct >= 0 ? '+' : ''}${e.pnlPct.toFixed(2)}%)` };
        break;
      case 'ORDER_CANCELLED':
        item = { id: `ev-${id}`, ts: e.timestamp, type: 'log', summary: `Cancel ${e.orderId}` };
        break;
      case 'STOP_UPDATED':
        item = { id: `ev-${id}`, ts: e.timestamp, type: 'log', summary: `Stop ${e.stopLoss.toLocaleString()}` };
        break;
      case 'CANDLE':
        continue;
      default: {
        const ev = e as { type: string; timestamp: number };
        item = { id: `ev-${id}`, ts: ev.timestamp, type: 'log', summary: ev.type };
      }
    }
    out.push(item);
  }
  return out;
}
