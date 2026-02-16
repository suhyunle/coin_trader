"use client";

import type { StrategyDto } from "@/types/api";

interface StrategyCardProps {
  strategy: StrategyDto;
}

export function StrategyCard({ strategy }: StrategyCardProps) {
  const p = strategy.promotionProgress;
  const dayPct = p.required > 0 ? (p.days / p.required) * 100 : 0;
  const tradePct = p.requiredTrades > 0 ? (p.trades / p.requiredTrades) * 100 : 0;

  return (
    <section className="rounded-lg border border-surface-border bg-surface-card p-3">
      <h3 className="text-xs font-medium text-muted mb-2">Strategy</h3>
      <div className="space-y-1.5 text-xs tabular-nums">
        <div className="flex justify-between">
          <span className="text-muted">Name</span>
          <span>{strategy.name}</span>
        </div>
        <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-muted">
          {Object.entries(strategy.params).map(([k, v]) => (
            <span key={k}>
              {k}={v}
            </span>
          ))}
        </div>
        <div className="flex justify-between pt-1">
          <span className="text-muted">Signal</span>
          <span
            className={
              strategy.currentSignal === "BUY"
                ? "text-buy"
                : strategy.currentSignal === "SELL"
                  ? "text-sell"
                  : "text-muted"
            }
          >
            {strategy.currentSignal}
          </span>
        </div>
        <p className="text-muted truncate" title={strategy.signalReason}>
          {strategy.signalReason}
        </p>
      </div>
      <div className="mt-2 pt-2 border-t border-surface-border">
        <div className="text-muted text-xs mb-1">Paper → Live</div>
        <div className="flex gap-2 text-xs tabular-nums">
          <span>{p.days}/{p.required} days</span>
          <span>{p.trades}/{p.requiredTrades} trades</span>
        </div>
        <div className="mt-1 h-1.5 bg-surface-border rounded overflow-hidden flex">
          <div
            className="bg-buy h-full"
            style={{ width: `${Math.min(100, (dayPct + tradePct) / 2)}%` }}
          />
        </div>
      </div>
    </section>
  );
}
