"use client";

import type { PositionDto } from "@/types/api";

interface PositionCardProps {
  position: PositionDto;
}

export function PositionCard({ position }: PositionCardProps) {
  const isLong = position.status === "LONG";

  return (
    <section className="rounded-lg border border-surface-border bg-surface-card p-3">
      <h3 className="text-xs font-medium text-muted mb-2">Position</h3>
      <div className="space-y-1.5 text-xs tabular-nums">
        <div className="flex justify-between">
          <span className="text-muted">Status</span>
          <span className={isLong ? "text-buy" : "text-foreground"}>{position.status}</span>
        </div>
        {isLong && (
          <>
            <div className="flex justify-between">
              <span className="text-muted">Qty</span>
              <span>{position.qty.toFixed(6)} BTC</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Entry</span>
              <span>{position.entryPrice.toLocaleString("ko-KR", { maximumFractionDigits: 0 })} KRW</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Stop</span>
              <span>{position.stopLoss.toLocaleString("ko-KR", { maximumFractionDigits: 0 })} KRW</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Unrealized PnL</span>
              <span className={position.unrealizedPnl >= 0 ? "text-buy" : "text-sell"}>
                {position.unrealizedPnl >= 0 ? "+" : ""}
                {position.unrealizedPnl.toLocaleString("ko-KR", { maximumFractionDigits: 0 })} KRW (
                {position.unrealizedPnlPct >= 0 ? "+" : ""}
                {position.unrealizedPnlPct.toFixed(2)}%)
              </span>
            </div>
          </>
        )}
        <div className="flex justify-between items-center pt-1">
          <span className="text-muted">Stop armed</span>
          <span className={position.stopArmed ? "text-buy" : "text-muted"}>{position.stopArmed ? "✓" : "—"}</span>
        </div>
      </div>
    </section>
  );
}
