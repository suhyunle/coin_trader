import type { TradingEvent, TradeRecord, PositionOpenedEvent, PositionClosedEvent, OrderFilledEvent } from '../types/index.js';

/**
 * 이벤트 로그에서 TradeRecord[] 변환
 */
export function buildTradeLog(events: readonly TradingEvent[], _totalBars: number): TradeRecord[] {
  const trades: TradeRecord[] = [];
  let currentEntry: { time: number; price: number; qty: number } | null = null;
  let entryBarIndex = 0;
  let barCount = 0;

  for (const event of events) {
    if (event.type === 'CANDLE') {
      barCount++;
    }

    if (event.type === 'POSITION_OPENED') {
      const e = event as PositionOpenedEvent;
      currentEntry = {
        time: e.timestamp,
        price: e.position.entryPrice,
        qty: e.position.qty,
      };
      entryBarIndex = barCount;
    }

    if (event.type === 'POSITION_CLOSED' && currentEntry) {
      const e = event as PositionClosedEvent;
      const holdingBars = barCount - entryBarIndex;

      trades.push({
        entryTime: currentEntry.time,
        exitTime: e.timestamp,
        entryPrice: e.entryPrice,
        exitPrice: e.exitPrice,
        qty: e.qty,
        pnl: e.pnl,
        pnlPct: e.pnlPct,
        holdingBars,
        reason: getExitReason(events, e.timestamp),
      });

      currentEntry = null;
    }
  }

  return trades;
}

function getExitReason(events: readonly TradingEvent[], timestamp: number): string {
  // 같은 타임스탬프의 시그널에서 reason 추출
  for (const e of events) {
    if (e.type === 'SIGNAL' && e.timestamp === timestamp && e.signal.reason) {
      return e.signal.reason;
    }
  }
  // 스톱 히트인지 확인 (paper-stop- / stop- 동일 처리)
  for (const e of events) {
    if (e.type === 'ORDER_FILLED' && e.timestamp === timestamp) {
      const fill = (e as OrderFilledEvent).fill;
      if (fill.orderId.startsWith('stop-') || fill.orderId.startsWith('paper-stop-')) return 'Stop loss hit';
      if (fill.orderId.startsWith('force-close')) return 'End of data';
    }
  }
  return 'unknown';
}
