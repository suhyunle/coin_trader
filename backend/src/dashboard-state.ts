import type { Candle } from './types/index.js';
import type { TradeRecord } from './types/report.js';
import type { LongTermSlice, ShortTermSlice } from './types/index.js';

/** 대시보드 타임라인 이벤트 (프론트 DTO) */
export interface TimelineEventDto {
  id: string;
  ts: number;
  type: 'signal' | 'order' | 'fill' | 'log';
  summary: string;
  detail?: string;
}

/** PAPER/LIVE 현재 포지션 (대시보드 저장용) */
export interface DashboardPosition {
  status: 'LONG';
  qty: number;
  entryPrice: number;
  stopLoss: number;
  trailingStop: number;
  entryTime: number;
  equity: number;
}

/**
 * 대시보드 API가 읽는 실시간 상태.
 * main에서 tick/candle/ws 이벤트 시 갱신한다.
 */
let lastPrice = 0;
let lastCandle: Candle | null = null;
let candles: Candle[] = [];
let wsState: string = 'CLOSED';
let mode: string = 'PAPER';
let auto: boolean = true;
let kill: boolean = false;
let events: TimelineEventDto[] = [];
let trades: TradeRecord[] = [];
let position: DashboardPosition | null = null;
let portfolioLongTerm: LongTermSlice | null = null;
let portfolioShortTerm: ShortTermSlice | null = null;

export const dashboardState = {
  getLastPrice: () => lastPrice,
  setLastPrice: (p: number) => { lastPrice = p; },

  getLastCandle: () => lastCandle,
  setLastCandle: (c: Candle | null) => { lastCandle = c; },

  getCandles: () => candles,
  setCandles: (c: Candle[]) => { candles = c; },

  getWsState: () => wsState,
  setWsState: (s: string) => { wsState = s; },

  getMode: () => mode,
  setMode: (m: string) => { mode = m; },

  getAuto: () => auto,
  setAuto: (on: boolean) => { auto = on; },

  getKill: () => kill,
  setKill: (on: boolean) => { kill = on; },

  getEvents: () => events,
  setEvents: (e: TimelineEventDto[]) => { events = e; },
  /** LIVE 등에서 주문/체결 시 타임라인에 바로 추가 (최대 500개 유지) */
  appendEvent: (ev: Omit<TimelineEventDto, 'id'>) => {
    const id = `ev-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    events = [...events.slice(-499), { ...ev, id }];
  },

  getTrades: () => trades,
  setTrades: (t: TradeRecord[]) => { trades = t; },

  getPosition: () => position,
  setPosition: (p: DashboardPosition | null) => { position = p; },

  getPortfolioLongTerm: () => portfolioLongTerm,
  setPortfolioLongTerm: (p: LongTermSlice | null) => { portfolioLongTerm = p; },

  getPortfolioShortTerm: () => portfolioShortTerm,
  setPortfolioShortTerm: (p: ShortTermSlice | null) => { portfolioShortTerm = p; },
};
