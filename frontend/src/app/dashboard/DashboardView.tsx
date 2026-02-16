"use client";

import dynamic from "next/dynamic";
import { useState, useEffect, useCallback } from "react";
import { Header } from "@/components/dashboard/Header";
import { BottomTabs } from "@/components/dashboard/BottomTabs";
import { PositionCard } from "@/components/dashboard/PositionCard";
import { PortfolioCard } from "@/components/dashboard/PortfolioCard";
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
  fetchPortfolio,
  fetchOrderHistory,
  postControlMode,
  postControlAuto,
  postControlKill,
  postTestOrder,
} from "@/lib/api";
import type { PortfolioResponse } from "@/lib/api";
import type { AppState, TimelineEventDto, TradeDto, PositionDto } from "@/types/api";
import {
  mockState,
  mockCandles,
  mockPosition,
  mockRisk,
  mockEvents,
  mockStrategy,
} from "@/lib/mock";

const ChartSection = dynamic(
  () => import("@/components/dashboard/ChartSection"),
  { ssr: false }
);

/** 1초마다 시세·포지션·포트폴리오 금액 갱신 */
const POLL_MS = 1000;

export default function DashboardView() {
  const [state, setState] = useState<AppState>(mockState);
  const [candles, setCandles] = useState(mockCandles);
  const [lastPrice, setLastPrice] = useState<number>(0);
  const [events, setEvents] = useState<TimelineEventDto[]>(mockEvents);
  const [orderHistory, setOrderHistory] = useState<TimelineEventDto[]>([]);
  const [trades, setTrades] = useState<TradeDto[]>([]);
  const [position, setPosition] = useState<PositionDto>(mockPosition);
  const [portfolio, setPortfolio] = useState<PortfolioResponse | null>(null);
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
        liveTradingAvailable: stateRes.liveTradingAvailable ?? s.liveTradingAvailable,
      }));
      setLastPrice(stateRes.lastPrice ?? 0);
    }
  }, []);

  useEffect(() => {
    const tick = async () => {
      const [stateRes, candlesRes, eventsRes, orderHistoryRes, tradesRes, positionRes, portfolioRes] = await Promise.all([
        fetchState(),
        fetchCandles(),
        fetchEvents(200),
        fetchOrderHistory(100),
        fetchTrades(),
        fetchPosition(),
        fetchPortfolio(),
      ]);
      if (stateRes) {
        setState((s) => ({
          ...s,
          mode: (stateRes.mode as AppState["mode"]) ?? s.mode,
          auto: stateRes.auto ?? s.auto,
          kill: stateRes.kill ?? s.kill,
          wsStatus: (stateRes.wsState as AppState["wsStatus"]) ?? s.wsStatus,
          liveTradingAvailable: stateRes.liveTradingAvailable ?? s.liveTradingAvailable,
        }));
        setLastPrice(stateRes.lastPrice ?? 0);
      }
      if (candlesRes && candlesRes.length > 0) setCandles(candlesRes);
      if (eventsRes) setEvents(eventsRes.length > 0 ? eventsRes : mockEvents);
      if (orderHistoryRes) setOrderHistory(Array.isArray(orderHistoryRes) ? orderHistoryRes : []);
      if (tradesRes) setTrades(tradesRes);
      if (positionRes) setPosition(positionRes);
      if (portfolioRes) setPortfolio(portfolioRes);
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
    const turnOn = !state.kill;
    const res = await postControlKill(turnOn);
    setControlPending(false);
    if (res?.ok && res.kill !== undefined) {
      setState((s) => ({ ...s, kill: res.kill, ...(res.kill ? { mode: "PAPER" as const } : {}) }));
      setLastAction(res.kill ? "KILL 활성화 — 신규 주문 금지" : "KILL 해제 — 신규 주문 재개");
    } else if (!res?.ok) {
      setLastAction("KILL 요청 실패 (연결 확인)");
    }
    await refreshState();
  }, [controlPending, refreshState, state.kill]);

  const handleTestOrder = useCallback(async () => {
    if (controlPending) return;
    setControlPending(true);
    const res = await postTestOrder();
    setControlPending(false);
    if (res?.ok) {
      setLastAction(res.message ?? `${res.krw?.toLocaleString()}원 매수 주문 접수 — 거래소에서 확인`);
    } else {
      setLastAction(res?.message ?? res?.error ?? "테스트 주문 실패 (LIVE 모드에서만 가능)");
    }
    await refreshState();
  }, [controlPending, refreshState]);

  const isLive = state.mode === "LIVE";

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-[#ededed]">
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
                orderHistory={orderHistory}
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
          <PortfolioCard
            longTerm={portfolio?.longTerm ?? null}
            shortTerm={portfolio?.shortTerm ?? null}
            loading={portfolio === null}
          />
          <TradesCard trades={trades} />
          <RiskCard risk={mockRisk} />
          <TradeControlCard
            state={state}
            lastAction={lastAction ?? "Entry blocked: Cooldown"}
            onModeChange={handleModeChange}
            onAutoChange={handleAutoChange}
            onKill={handleKill}
            onTestOrder={handleTestOrder}
            controlPending={controlPending}
            liveTradingAvailable={state.liveTradingAvailable}
          />
          <StrategyCard strategy={mockStrategy} />
        </div>
      </main>
    </div>
  );
}
