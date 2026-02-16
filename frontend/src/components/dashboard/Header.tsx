"use client";

import type { AppState } from "@/types/api";

interface HeaderProps {
  state: AppState;
  lastPrice?: number;
  onModeChange?: (mode: AppState["mode"]) => void;
  onAutoChange?: (on: boolean) => void;
  onKill?: () => void;
  controlPending?: boolean;
  liveRibbon?: boolean;
}

export function Header({
  state,
  lastPrice = 0,
  onModeChange,
  onAutoChange,
  onKill,
  controlPending = false,
  liveRibbon,
}: HeaderProps) {
  const wsLabel =
    state.wsStatus === "CONNECTED"
      ? "WS ●"
      : state.wsStatus === "CONNECTING" || state.wsStatus === "RECONNECTING"
        ? "WS ◐"
        : "WS ○";
  const busy = controlPending;

  return (
    <header
      className={`fixed left-0 right-0 z-50 h-14 flex items-center px-4 bg-surface border-b border-surface-border ${liveRibbon ? "top-6" : "top-0"}`}
    >
      {/* 좌: 심볼 + 현재가(강조) + 연결 + 지연 */}
      <div className="flex items-center gap-4 min-w-0 flex-1 max-w-[380px]">
        <span className="font-semibold text-sm tabular-nums shrink-0">BTC/KRW</span>
        {lastPrice > 0 && (
          <span
            className="text-sm font-semibold tabular-nums text-foreground truncate"
            title="BTC/KRW 현재가 (실시간)"
          >
            {lastPrice.toLocaleString("ko-KR", { maximumFractionDigits: 0 })} 원
          </span>
        )}
        <span
          className={`text-xs tabular-nums shrink-0 ${
            state.wsStatus === "CONNECTED" ? "text-buy" : "text-muted"
          }`}
          title="웹소켓 연결 상태"
        >
          {wsLabel}
        </span>
        <span className="text-xs text-muted tabular-nums shrink-0" title="지연 시간">
          {state.latencyMs} ms
        </span>
      </div>

      {/* 중앙: 모드 버튼 (클릭 가능) */}
      <div className="flex shrink-0 justify-center">
        <div className="flex rounded-md overflow-hidden border border-surface-border">
          {(["BACKTEST", "PAPER", "LIVE"] as const).map((m) => (
            <button
              key={m}
              type="button"
              disabled={busy}
              title={busy ? "처리 중…" : `모드: ${m}`}
              onClick={() => onModeChange?.(m)}
              className={`px-4 py-1.5 text-xs font-medium tabular-nums transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${
                state.mode === m
                  ? m === "LIVE"
                    ? "bg-live text-white"
                    : "bg-surface-card text-foreground"
                  : "text-muted bg-surface hover:bg-surface-card hover:text-foreground"
              }`}
            >
              {m}
              {m === "LIVE" && " ⚠"}
            </button>
          ))}
        </div>
      </div>

      {/* 우: AUTO, KILL, 설정 */}
      <div className="flex items-center gap-3 w-[220px] justify-end shrink-0">
        <label className="flex items-center gap-2 cursor-pointer" title="자동매매 On/Off">
          <span className="text-xs text-muted">AUTO</span>
          <button
            type="button"
            role="switch"
            aria-checked={state.auto}
            disabled={busy}
            onClick={() => onAutoChange?.(!state.auto)}
            className={`relative w-9 h-5 rounded-full transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${
              state.auto ? "bg-buy" : "bg-surface-border"
            }`}
          >
            <span
              className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                state.auto ? "left-4" : "left-0.5"
              }`}
            />
          </button>
        </label>
        <button
          type="button"
          disabled={busy}
          title={state.kill ? "킬스위치 해제 (신규 주문 재개)" : "신규 주문 즉시 중단 (킬스위치)"}
          onClick={onKill}
          className={`px-3 py-1.5 text-xs font-medium rounded text-white hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed ${
            state.kill ? "bg-muted ring-2 ring-danger hover:bg-danger/80" : "bg-danger hover:bg-red-700"
          }`}
        >
          {state.kill ? "KILL 해제" : "KILL"}
        </button>
        <button type="button" className="p-1.5 text-muted hover:text-foreground" title="설정">
          ⚙
        </button>
        <button type="button" className="text-xs text-muted hover:text-foreground" title="로그">
          로그
        </button>
      </div>
    </header>
  );
}
