"use client";

import dynamic from "next/dynamic";
import { useState, useEffect, useCallback } from "react";
import { Header } from "@/components/dashboard/Header";
import { BottomTabs } from "@/components/dashboard/BottomTabs";

const ChartSection = dynamic(
  () => import("@/components/dashboard/ChartSection").then((m) => ({ default: m.ChartSection })),
  { ssr: false }
);
import { PositionCard } from "@/components/dashboard/PositionCard";
import { RiskCard } from "@/components/dashboard/RiskCard";
import { TradeControlCard } from "@/components/dashboard/TradeControlCard";
import { StrategyCard } from "@/components/dashboard/StrategyCard";
import { TradesCard } from "@/components/dashboard/TradesCard";
import {
  fetchState,
  fetchCandles,
  fetchEvents,
  fetchTrades,
  fetchPosition,
  postControlMode,
  postControlAuto,
  postControlKill,
} from "@/lib/api";
import type { AppState, TimelineEventDto, TradeDto, PositionDto } from "@/types/api";
import {
  mockState,
  mockCandles,
  mockPosition,
  mockRisk,
  mockEvents,
  mockStrategy,
} from "@/lib/mock";

const POLL_MS = 2000;

export default function DashboardPage() {
  const [state, setState] = useState<AppState>(mockState);
  const [candles, setCandles] = useState(mockCandles);
  const [lastPrice, setLastPrice] = useState<number>(0);
  const [events, setEvents] = useState<TimelineEventDto[]>(mockEvents);
  const [trades, setTrades] = useState<TradeDto[]>([]);
  const [position, setPosition] = useState<PositionDto>(mockPosition);
  const [controlPending, setControlPending] = useState(false);
  const [lastAction, setLastAction] = useState<string | undefined>(undefined);

  const refreshState = useCallback(async () => {
    const stateRes = await fetchState();
    if (stateRes) {
      setState((s) => ({
        ...s,
        mode: (stateRes.mode as AppState["mode"]) ?? s.mode,
        auto: stateRes.auto ?? s.auto,
        kill: stateRes.kill ?? s.kill,
        wsStatus: (stateRes.wsState as AppState["wsStatus"]) ?? s.wsStatus,
      }));
      setLastPrice(stateRes.lastPrice ?? 0);
    }
  }, []);

  useEffect(() => {
    const tick = async () => {
      const [stateRes, candlesRes, eventsRes, tradesRes, positionRes] = await Promise.all([
        fetchState(),
        fetchCandles(),
        fetchEvents(200),
        fetchTrades(),
        fetchPosition(),
      ]);
      if (stateRes) {
        setState((s) => ({
          ...s,
          mode: (stateRes.mode as AppState["mode"]) ?? s.mode,
          auto: stateRes.auto ?? s.auto,
          kill: stateRes.kill ?? s.kill,
          wsStatus: (stateRes.wsState as AppState["wsStatus"]) ?? s.wsStatus,
        }));
        setLastPrice(stateRes.lastPrice ?? 0);
      }
      if (candlesRes && candlesRes.length > 0) setCandles(candlesRes);
      if (eventsRes) setEvents(eventsRes.length > 0 ? eventsRes : mockEvents);
      if (tradesRes) setTrades(tradesRes);
      if (positionRes) setPosition(positionRes);
    };
    tick();
    const id = setInterval(tick, POLL_MS);
    return () => clearInterval(id);
  }, []);

  const handleModeChange = useCallback(
    async (mode: AppState["mode"]) => {
      if (controlPending) return;
      setControlPending(true);
      const res = await postControlMode(mode);
      setControlPending(false);
      if (res?.ok) {
        setState((s) => ({ ...s, mode }));
        setLastAction(`모드 → ${mode}`);
      } else {
        setLastAction("모드 변경 실패 (연결 확인)");
      }
      await refreshState();
    },
    [controlPending, refreshState]
  );

  const handleAutoChange = useCallback(
    async (on: boolean) => {
      if (controlPending) return;
      setControlPending(true);
      const res = await postControlAuto(on);
      setControlPending(false);
      if (res?.ok) {
        setState((s) => ({ ...s, auto: on }));
        setLastAction(`AUTO → ${on ? "On" : "Off"}`);
      } else {
        setLastAction("AUTO 변경 실패 (연결 확인)");
      }
      await refreshState();
    },
    [controlPending, refreshState]
  );

  const handleKill = useCallback(async () => {
    if (controlPending) return;
    setControlPending(true);
    const res = await postControlKill();
    setControlPending(false);
    if (res?.ok) {
      setState((s) => ({ ...s, mode: "PAPER" }));
      setLastAction("KILL 활성화 — 신규 주문 금지");
    } else {
      setLastAction("KILL 요청 실패 (연결 확인)");
    }
    await refreshState();
  }, [controlPending, refreshState]);

  const isLive = state.mode === "LIVE";

  return (
    <div className="min-h-screen bg-background text-foreground">
      {isLive && (
        <div className="fixed top-0 left-0 right-0 z-[60] h-6 bg-live text-white flex items-center justify-center text-xs font-medium">
          LIVE — 실거래 모드
        </div>
      )}
      <Header
        state={state}
        liveRibbon={isLive}
        lastPrice={lastPrice}
        onModeChange={handleModeChange}
        onAutoChange={handleAutoChange}
        onKill={handleKill}
        controlPending={controlPending}
      />

      <main
        className="max-w-[1440px] mx-auto flex h-[calc(100vh-56px)]"
        style={{ paddingTop: isLive ? "80px" : "56px" }}
      >
        <div className="flex flex-col w-[70%] min-w-0 border-r border-surface-border">
          <div className="flex-1 min-h-0 flex flex-col">
            <div className="flex-[0.65] min-h-0">
              <ChartSection
                candles={candles}
                lastPrice={lastPrice}
                trend="Side"
                atr={52000}
                spreadBps={12.5}
                tradeAllowed={mockRisk.riskOk}
              />
            </div>
            <div className="flex-[0.35] min-h-0 max-h-[240px]">
              <BottomTabs
                events={events}
                diagnostics={[
                  { message: "WS connected", ts: 1737000000000 - 1000 },
                  { message: "Rate limit OK", ts: 1737000000000 },
                ]}
              />
            </div>
          </div>
        </div>

        <div className="w-[30%] flex flex-col gap-3 p-3 overflow-auto bg-surface min-w-[280px]">
          <PositionCard position={position} />
          <TradesCard trades={trades} />
          <RiskCard risk={mockRisk} />
          <TradeControlCard
            state={state}
            lastAction={lastAction ?? "Entry blocked: Cooldown"}
            onModeChange={handleModeChange}
            onAutoChange={handleAutoChange}
            onKill={handleKill}
            controlPending={controlPending}
          />
          <StrategyCard strategy={mockStrategy} />
        </div>
      </main>
    </div>
  );
}
