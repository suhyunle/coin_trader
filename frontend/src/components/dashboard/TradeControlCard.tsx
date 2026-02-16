"use client";

import type { AppState } from "@/types/api";

interface TradeControlCardProps {
  state: AppState;
  lastAction?: string;
  onModeChange?: (mode: AppState["mode"]) => void;
  onAutoChange?: (on: boolean) => void;
  onKill?: () => void;
  onTestOrder?: () => void;
  controlPending?: boolean;
  /** 백엔드가 LIVE로 기동되어 테스트 주문 가능한지 (false면 버튼 비활성 + 안내) */
  liveTradingAvailable?: boolean;
}

export function TradeControlCard({
  state,
  lastAction,
  onModeChange,
  onAutoChange,
  onKill,
  onTestOrder,
  controlPending = false,
  liveTradingAvailable = false,
}: TradeControlCardProps) {
  const busy = controlPending;
  const canTestOrder = state.mode === "LIVE" && liveTradingAvailable && !state.kill;

  return (
    <section className="rounded-lg border border-surface-border bg-surface-card p-3">
      <h3 className="text-xs font-medium text-muted mb-2">Trade Control</h3>
      <div className="space-y-2 text-xs">
        <div className="flex items-center justify-between gap-2">
          <span className="text-muted">Mode</span>
          <div className="flex rounded overflow-hidden border border-surface-border">
            {(["BACKTEST", "PAPER", "LIVE"] as const).map((m) => (
              <button
                key={m}
                type="button"
                disabled={busy}
                title={busy ? "처리 중…" : `모드: ${m}`}
                onClick={() => onModeChange?.(m)}
                className={`px-2 py-1 transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${
                  state.mode === m
                    ? m === "LIVE"
                      ? "bg-live text-white"
                      : "bg-surface-border text-foreground"
                    : "text-muted hover:bg-surface hover:text-foreground"
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-muted">AUTO</span>
          <button
            type="button"
            disabled={busy}
            title={busy ? "처리 중…" : "자동매매 On/Off"}
            onClick={() => onAutoChange?.(!state.auto)}
            className={`${state.auto ? "text-buy" : "text-muted"} hover:underline disabled:opacity-60 disabled:cursor-not-allowed`}
          >
            {state.auto ? "On" : "Off"}
          </button>
        </div>
        <button
          type="button"
          disabled={busy}
          title={state.kill ? "킬스위치 해제" : "신규 주문 즉시 중단"}
          onClick={onKill}
          className={`w-full py-1.5 rounded text-white text-xs font-medium disabled:opacity-60 disabled:cursor-not-allowed ${
            state.kill ? "bg-muted ring-2 ring-danger hover:bg-danger/80" : "bg-danger hover:bg-red-700"
          }`}
        >
          {state.kill ? "KILL 해제 (클릭 시 재개)" : "KILL (신규 주문 금지)"}
        </button>
        {state.mode === "LIVE" && (
          <button
            type="button"
            disabled={busy || !liveTradingAvailable || state.kill}
            title={
              state.kill
                ? "킬스위치 켜짐 — 주문 불가 (KILL 해제 후 사용)"
                : liveTradingAvailable
                  ? "5천원 시장가 매수 (실거래로 체결 확인)"
                  : "테스트 주문은 백엔드를 LIVE 모드로 실행했을 때만 가능합니다. (npm run live로 재시작)"
            }
            onClick={onTestOrder}
            className="w-full py-1.5 rounded text-xs font-medium bg-accent text-accent-foreground hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {state.kill
              ? "테스트 매수 (KILL 켜짐 — 비활성)"
              : canTestOrder
                ? "테스트 매수 (5천원 실거래)"
                : "테스트 매수 (서버를 npm run live로 재시작)"}
          </button>
        )}
        {lastAction && (
          <p className="text-muted truncate pt-1 border-t border-surface-border" title={lastAction}>
            Last: {lastAction}
          </p>
        )}
      </div>
    </section>
  );
}
