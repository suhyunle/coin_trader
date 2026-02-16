"use client";

import type { PortfolioLongTerm, PortfolioShortTerm } from "@/lib/api";

interface PortfolioCardProps {
  longTerm: PortfolioLongTerm | null;
  shortTerm: PortfolioShortTerm | null;
  /** API 응답 대기 중이면 true (카드는 항상 표시, 안내 문구) */
  loading?: boolean;
}

function formatKrw(n: number): string {
  return n.toLocaleString("ko-KR", { maximumFractionDigits: 0 });
}

export function PortfolioCard({ longTerm, shortTerm, loading = false }: PortfolioCardProps) {
  return (
    <section className="rounded-lg border border-surface-border bg-surface-card p-3">
      <h3 className="text-xs font-medium text-muted mb-2">전략별 포트폴리오</h3>
      {loading && !longTerm && !shortTerm && (
        <p className="text-muted text-xs">백엔드 연결 대기 중…</p>
      )}
      <div className="space-y-3 text-xs tabular-nums">
        {longTerm && (
          <div className="rounded border border-surface-border p-2 bg-surface">
            <div className="font-medium text-buy mb-1">장기 DCA</div>
            <div className="flex justify-between">
              <span className="text-muted">보유 BTC</span>
              <span>{longTerm.btcQty.toFixed(6)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">평균단가</span>
              <span>{formatKrw(longTerm.avgCostKrw)} KRW</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">누적투자</span>
              <span>{formatKrw(longTerm.totalInvestedKrw)} KRW</span>
            </div>
            {longTerm.equityKrw != null && (
              <div className="flex justify-between">
                <span className="text-muted">평가금액</span>
                <span>{formatKrw(longTerm.equityKrw)} KRW</span>
              </div>
            )}
            {longTerm.unrealizedPnlKrw != null && (
              <div className="flex justify-between">
                <span className="text-muted">평가손익</span>
                <span className={longTerm.unrealizedPnlKrw >= 0 ? "text-buy" : "text-sell"}>
                  {longTerm.unrealizedPnlKrw >= 0 ? "+" : ""}
                  {formatKrw(longTerm.unrealizedPnlKrw)} KRW
                </span>
              </div>
            )}
          </div>
        )}
        {shortTerm && (
          <div className="rounded border border-surface-border p-2 bg-surface">
            <div className="font-medium text-foreground mb-1">단기 RSI+공포</div>
            <div className="flex justify-between">
              <span className="text-muted">보유 BTC</span>
              <span>{shortTerm.btcQty.toFixed(6)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">진입가</span>
              <span>{formatKrw(shortTerm.entryPriceKrw)} KRW</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">분할 남은 횟수</span>
              <span>{shortTerm.entrySplitsLeft} / 3</span>
            </div>
            {shortTerm.equityKrw != null && (
              <div className="flex justify-between">
                <span className="text-muted">평가금액</span>
                <span>{formatKrw(shortTerm.equityKrw)} KRW</span>
              </div>
            )}
            {shortTerm.unrealizedPnlKrw != null && (
              <div className="flex justify-between">
                <span className="text-muted">평가손익</span>
                <span className={shortTerm.unrealizedPnlKrw >= 0 ? "text-buy" : "text-sell"}>
                  {shortTerm.unrealizedPnlKrw >= 0 ? "+" : ""}
                  {formatKrw(shortTerm.unrealizedPnlKrw)} KRW
                </span>
              </div>
            )}
          </div>
        )}
        {!loading && !longTerm && !shortTerm && (
          <p className="text-muted text-xs">포트폴리오 데이터 없음</p>
        )}
      </div>
    </section>
  );
}
