import type { TradingEvent, EventType } from '../types/index.js';

type EventHandler = (event: TradingEvent) => void;

/**
 * 타입드 이벤트 버스 — 이벤트 로그 보관으로 리플레이 가능
 */
export class EventBus {
  private handlers: Map<EventType, EventHandler[]> = new Map();
  private log: TradingEvent[] = [];

  on(type: EventType, handler: EventHandler): void {
    const list = this.handlers.get(type) ?? [];
    list.push(handler);
    this.handlers.set(type, list);
  }

  emit(event: TradingEvent): void {
    this.log.push(event);
    const handlers = this.handlers.get(event.type);
    if (handlers) {
      for (const h of handlers) {
        h(event);
      }
    }
  }

  getLog(): readonly TradingEvent[] {
    return this.log;
  }

  clearLog(): void {
    this.log = [];
  }

  reset(): void {
    this.handlers.clear();
    this.log = [];
  }
}
