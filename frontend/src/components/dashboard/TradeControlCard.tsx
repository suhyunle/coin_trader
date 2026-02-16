"use client";

import type { AppState } from "@/types/api";

interface TradeControlCardProps {
  state: AppState;
  lastAction?: string;
  onModeChange?: (mode: AppState["mode"]) => void;
  onAutoChange?: (on: boolean) => void;
  onKill?: () => void;
  controlPending?: boolean;
}

export function TradeControlCard({
  state,
  lastAction,
  onModeChange,
  onAutoChange,
  onKill,
  controlPending = false,
}: TradeControlCardProps) {
  const busy = controlPending;

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
          title="신규 주문 즉시 중단"
          onClick={onKill}
          className={`w-full py-1.5 rounded text-white text-xs font-medium disabled:opacity-60 disabled:cursor-not-allowed ${
            state.kill ? "bg-muted ring-2 ring-danger" : "bg-danger hover:bg-red-700"
          }`}
        >
          {state.kill ? "KILL ✓ (신규 주문 금지)" : "KILL (신규 주문 금지)"}
        </button>
        {lastAction && (
          <p className="text-muted truncate pt-1 border-t border-surface-border" title={lastAction}>
            Last: {lastAction}
          </p>
        )}
      </div>
    </section>
  );
}
