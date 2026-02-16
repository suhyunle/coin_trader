/** 브라우저에서는 현재 페이지와 같은 host 사용 → 192.0.0.2 등에서 CORS/PNA 차단 방지 */
export function getApiBase(): string {
  if (process.env.NEXT_PUBLIC_API_URL) return process.env.NEXT_PUBLIC_API_URL;
  if (typeof window !== "undefined") return `http://${window.location.hostname}:4000`;
  return "http://localhost:4000";
}

export interface StateResponse {
  mode: string;
  auto: boolean;
  kill?: boolean;
  lastPrice: number;
  wsState: string;
  lastCandle: { timestamp: number; open: number; high: number; low: number; close: number; volume: number } | null;
  /** true면 백엔드가 LIVE로 기동되어 테스트 주문 가능 */
  liveTradingAvailable?: boolean;
}

export interface CandleDto {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export async function fetchState(): Promise<StateResponse | null> {
  try {
    const res = await fetch(`${getApiBase()}/api/state`, { cache: "no-store" });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function fetchCandles(): Promise<CandleDto[] | null> {
  try {
    const res = await fetch(`${getApiBase()}/api/candles`, { cache: "no-store" });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function postControlMode(mode: string): Promise<{ ok: boolean } | null> {
  try {
    const res = await fetch(`${getApiBase()}/api/control/mode`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode }),
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function postControlAuto(on: boolean): Promise<{ ok: boolean } | null> {
  try {
    const res = await fetch(`${getApiBase()}/api/control/auto`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ on }),
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

/** @param on true=킬 활성화, false=킬 해제(취소) */
export async function postControlKill(on: boolean): Promise<{ ok: boolean; kill: boolean } | null> {
  try {
    const res = await fetch(`${getApiBase()}/api/control/kill`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ on }),
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

/** LIVE 전용: 소액 시장가 매수 (실거래 확인용, 5천~1만원) */
export async function postTestOrder(krw?: number): Promise<{
  ok: boolean;
  orderId?: string;
  krw?: number;
  message?: string;
  error?: string;
} | null> {
  try {
    const res = await fetch(`${getApiBase()}/api/test-order`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(krw != null ? { krw } : {}),
    });
    const data = await res.json();
    return data;
  } catch {
    return null;
  }
}

import type { TimelineEventDto, TradeDto, ExchangeDto, PositionDto } from "@/types/api";

export interface PortfolioLongTerm {
  strategyId: string;
  cashKrw: number;
  btcQty: number;
  avgCostKrw: number;
  totalInvestedKrw: number;
  lastDipBuyAt: number;
  equityKrw?: number;
  unrealizedPnlKrw?: number;
}

export interface PortfolioShortTerm {
  strategyId: string;
  cashKrw: number;
  btcQty: number;
  entryPriceKrw: number;
  entryTime: number;
  stopLossKrw: number;
  trailingStopKrw: number;
  entrySplitsLeft: number;
  equityKrw?: number;
  unrealizedPnlKrw?: number;
}

export interface PortfolioResponse {
  longTerm: PortfolioLongTerm | null;
  shortTerm: PortfolioShortTerm | null;
}

export async function fetchPortfolio(): Promise<PortfolioResponse | null> {
  try {
    const res = await fetch(`${getApiBase()}/api/portfolio`, { cache: "no-store" });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function fetchPosition(): Promise<PositionDto | null> {
  try {
    const res = await fetch(`${getApiBase()}/api/position`, { cache: "no-store" });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function fetchExchanges(): Promise<ExchangeDto[] | null> {
  try {
    const res = await fetch(`${getApiBase()}/api/exchanges`, { cache: "no-store" });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function fetchEvents(limit = 200): Promise<TimelineEventDto[] | null> {
  try {
    const res = await fetch(`${getApiBase()}/api/events?limit=${limit}`, { cache: "no-store" });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

/** LIVE: 거래소 체결 내역 (봇 + 수동 주문 모두). 비 LIVE면 [] */
export async function fetchOrderHistory(limit = 100): Promise<TimelineEventDto[] | null> {
  try {
    const res = await fetch(`${getApiBase()}/api/orders/history?limit=${limit}`, { cache: "no-store" });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function fetchTrades(): Promise<TradeDto[] | null> {
  try {
    const res = await fetch(`${getApiBase()}/api/trades`, { cache: "no-store" });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}
