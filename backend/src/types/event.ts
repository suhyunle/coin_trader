import type { Candle } from './candle.js';
import type { Order, Fill } from './order.js';
import type { Position } from './position.js';
import type { StrategySignal } from './signal.js';

export type EventType =
  | 'CANDLE'
  | 'SIGNAL'
  | 'ORDER_CREATED'
  | 'ORDER_FILLED'
  | 'ORDER_CANCELLED'
  | 'POSITION_OPENED'
  | 'POSITION_CLOSED'
  | 'STOP_UPDATED';

export interface BaseEvent {
  readonly type: EventType;
  readonly timestamp: number;
}

export interface CandleEvent extends BaseEvent {
  readonly type: 'CANDLE';
  readonly candle: Candle;
}

export interface SignalEvent extends BaseEvent {
  readonly type: 'SIGNAL';
  readonly signal: StrategySignal;
}

export interface OrderCreatedEvent extends BaseEvent {
  readonly type: 'ORDER_CREATED';
  readonly order: Order;
}

export interface OrderFilledEvent extends BaseEvent {
  readonly type: 'ORDER_FILLED';
  readonly fill: Fill;
}

export interface OrderCancelledEvent extends BaseEvent {
  readonly type: 'ORDER_CANCELLED';
  readonly orderId: string;
}

export interface PositionOpenedEvent extends BaseEvent {
  readonly type: 'POSITION_OPENED';
  readonly position: Position;
}

export interface PositionClosedEvent extends BaseEvent {
  readonly type: 'POSITION_CLOSED';
  readonly entryPrice: number;
  readonly exitPrice: number;
  readonly qty: number;
  readonly pnl: number;
  readonly pnlPct: number;
}

export interface StopUpdatedEvent extends BaseEvent {
  readonly type: 'STOP_UPDATED';
  readonly stopLoss: number;
  readonly trailingStop: number;
}

export type TradingEvent =
  | CandleEvent
  | SignalEvent
  | OrderCreatedEvent
  | OrderFilledEvent
  | OrderCancelledEvent
  | PositionOpenedEvent
  | PositionClosedEvent
  | StopUpdatedEvent;
