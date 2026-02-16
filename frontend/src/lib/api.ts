const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export interface StateResponse {
  mode: string;
  auto: boolean;
  kill?: boolean;
  lastPrice: number;
  wsState: string;
  lastCandle: { timestamp: number; open: number; high: number; low: number; close: number; volume: number } | null;
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
    const res = await fetch(`${API_BASE}/api/state`, { cache: "no-store" });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function fetchCandles(): Promise<CandleDto[] | null> {
  try {
    const res = await fetch(`${API_BASE}/api/candles`, { cache: "no-store" });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function postControlMode(mode: string): Promise<{ ok: boolean } | null> {
  try {
    const res = await fetch(`${API_BASE}/api/control/mode`, {
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
    const res = await fetch(`${API_BASE}/api/control/auto`, {
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

export async function postControlKill(): Promise<{ ok: boolean } | null> {
  try {
    const res = await fetch(`${API_BASE}/api/control/kill`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

import type { TimelineEventDto, TradeDto, ExchangeDto, PositionDto } from "@/types/api";

export async function fetchPosition(): Promise<PositionDto | null> {
  try {
    const res = await fetch(`${API_BASE}/api/position`, { cache: "no-store" });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function fetchExchanges(): Promise<ExchangeDto[] | null> {
  try {
    const res = await fetch(`${API_BASE}/api/exchanges`, { cache: "no-store" });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function fetchEvents(limit = 200): Promise<TimelineEventDto[] | null> {
  try {
    const res = await fetch(`${API_BASE}/api/events?limit=${limit}`, { cache: "no-store" });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function fetchTrades(): Promise<TradeDto[] | null> {
  try {
    const res = await fetch(`${API_BASE}/api/trades`, { cache: "no-store" });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}
