"use client";

import { useState } from "react";
import type { TimelineEventDto } from "@/types/api";

type TabId = "signals" | "orders" | "diagnostics";

interface BottomTabsProps {
  events: TimelineEventDto[];
  /** LIVE 시 거래소 체결 내역 (봇 + 수동 주문). Orders 탭에서 events와 병합 표시 */
  orderHistory?: TimelineEventDto[];
  signals?: TimelineEventDto[];
  diagnostics?: { message: string; ts: number }[];
}

export function BottomTabs({ events, orderHistory = [], signals, diagnostics = [] }: BottomTabsProps) {
  const [tab, setTab] = useState<TabId>("signals");
  const botOrdersAndFills = events.filter((e) => e.type === "order" || e.type === "fill");
  const ordersList =
    tab === "orders"
      ? [...botOrdersAndFills, ...orderHistory].sort((a, b) => b.ts - a.ts)
      : [];
  const list = tab === "signals" ? (signals ?? events.filter((e) => e.type === "signal")) : ordersList;
  const diagList = tab === "diagnostics" ? diagnostics : [];

  return (
    <div className="flex flex-col h-full min-h-0 border-t border-surface-border bg-surface">
      <div className="flex gap-0 border-b border-surface-border">
        {(
          [
            ["signals", "Signals"],
            ["orders", "Orders/Fills"],
            ["diagnostics", "Diagnostics"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`px-4 py-2 text-xs font-medium ${
              tab === id ? "bg-surface-card text-foreground border-b-2 border-foreground" : "text-muted hover:text-foreground"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-auto p-2 min-h-0">
        {tab === "diagnostics" ? (
          <ul className="space-y-1 text-xs text-muted">
            {diagList.length === 0 ? (
              <li>No diagnostics</li>
            ) : (
              diagList.map((d, i) => (
                <li key={i} className="tabular-nums">
                  <span suppressHydrationWarning>{new Date(d.ts).toISOString().slice(11, 23)}</span> — {d.message}
                </li>
              ))
            )}
          </ul>
        ) : (
          <ul className="space-y-1 text-xs">
            {list.slice(0, 50).map((e) => (
              <li key={e.id} className="flex gap-2 tabular-nums text-muted">
                <span suppressHydrationWarning>{new Date(e.ts).toISOString().slice(11, 23)}</span>
                <span className="text-foreground">{e.summary}</span>
                {e.detail && <span className="text-muted truncate">{e.detail}</span>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
