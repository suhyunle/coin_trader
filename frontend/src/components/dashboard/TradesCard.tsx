"use client";

import type { TradeDto } from "@/types/api";

interface TradesCardProps {
  trades: TradeDto[];
}

function formatTime(ms: number): string {
  const d = new Date(ms);
  return d.toLocaleString("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function TradesCard({ trades }: TradesCardProps) {
  const list = [...trades].reverse();

  return (
    <section className="rounded-lg border border-surface-border bg-surface-card p-3">
      <h3 className="text-xs font-medium text-muted mb-2">거래 내역 (매수/매도 시점)</h3>
      <div className="max-h-[220px] overflow-auto space-y-2">
        {list.length === 0 ? (
          <p className="text-xs text-muted">거래 내역이 없습니다.</p>
        ) : (
          list.map((t, i) => (
            <div
              key={`${t.entryTime}-${t.exitTime}-${i}`}
              className="text-xs border-b border-surface-border pb-2 last:border-0 last:pb-0"
            >
              <div className="flex justify-between gap-2 tabular-nums">
                <span className="text-muted shrink-0">진입</span>
                <span className="text-foreground">{formatTime(t.entryTime)}</span>
              </div>
              <div className="flex justify-between gap-2 tabular-nums">
                <span className="text-muted shrink-0">청산</span>
                <span className="text-foreground">{formatTime(t.exitTime)}</span>
              </div>
              <div className="flex justify-between gap-2 tabular-nums mt-0.5">
                <span className="text-muted">매수가</span>
                <span>{t.entryPrice.toLocaleString("ko-KR", { maximumFractionDigits: 0 })} KRW</span>
              </div>
              <div className="flex justify-between gap-2 tabular-nums">
                <span className="text-muted">매도가</span>
                <span>{t.exitPrice.toLocaleString("ko-KR", { maximumFractionDigits: 0 })} KRW</span>
              </div>
              <div className="flex justify-between gap-2 tabular-nums">
                <span className="text-muted">수량</span>
                <span>{t.qty.toFixed(6)} BTC</span>
              </div>
              <div className="flex justify-between gap-2 tabular-nums mt-0.5">
                <span className="text-muted">손익</span>
                <span className={t.pnl >= 0 ? "text-buy" : "text-sell"}>
                  {t.pnl >= 0 ? "+" : ""}
                  {t.pnl.toLocaleString("ko-KR", { maximumFractionDigits: 0 })} KRW (
                  {t.pnlPct >= 0 ? "+" : ""}
                  {t.pnlPct.toFixed(2)}%)
                </span>
              </div>
              {t.reason && (
                <p className="text-muted truncate mt-0.5" title={t.reason}>
                  {t.reason}
                </p>
              )}
            </div>
          ))
        )}
      </div>
    </section>
  );
}
