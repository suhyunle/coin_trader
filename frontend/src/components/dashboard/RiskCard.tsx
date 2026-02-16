"use client";

import type { RiskDto } from "@/types/api";

interface RiskCardProps {
  risk: RiskDto;
}

export function RiskCard({ risk }: RiskCardProps) {
  return (
    <section className="rounded-lg border border-surface-border bg-surface-card p-3">
      <h3 className="text-xs font-medium text-muted mb-2">Risk</h3>
      <div className="space-y-1.5 text-xs tabular-nums">
        <div className="flex justify-between">
          <span className="text-muted" title="거래당 리스크 비율">Risk/Trade</span>
          <span>{risk.riskPerTradePct}%</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted" title="일일 최대 손실 한도">Daily Loss Limit</span>
          <span>{risk.dailyLossLimitPct}%</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted">Today PnL</span>
          <span className={risk.dailyPnl >= 0 ? "text-buy" : "text-sell"}>
            {risk.dailyPnl >= 0 ? "+" : ""}
            {risk.dailyPnl.toLocaleString("ko-KR", { maximumFractionDigits: 0 })} KRW
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted" title="1회 최대 주문 가능 금액 (BTC 가격 아님)">
            Max Order
          </span>
          <span>{risk.maxOrderKrw.toLocaleString("ko-KR", { maximumFractionDigits: 0 })} KRW</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted">Cooldown</span>
          <span>{risk.cooldownRemainingSec > 0 ? `${risk.cooldownRemainingSec}s` : "—"}</span>
        </div>
      </div>
      <div className="mt-2 pt-2 border-t border-surface-border flex items-center justify-between">
        <span className="text-muted">Risk</span>
        <span className={risk.riskOk ? "text-buy font-medium" : "text-danger font-medium"}>
          {risk.riskOk ? "OK ✅" : "Blocked ❌"}
        </span>
      </div>
      {risk.blockedReason && (
        <p className="mt-1 text-xs text-danger truncate" title={risk.blockedReason}>
          {risk.blockedReason}
        </p>
      )}
    </section>
  );
}
