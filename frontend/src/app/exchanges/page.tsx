"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { fetchExchanges } from "@/lib/api";
import type { ExchangeDto } from "@/types/api";

export default function ExchangesPage() {
  const [exchanges, setExchanges] = useState<ExchangeDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      const list = await fetchExchanges();
      if (cancelled) return;
      if (list) {
        setExchanges(list);
      } else {
        setError("거래소 목록을 불러오지 못했습니다. 백엔드 연결을 확인해 주세요.");
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const countryLabel: Record<string, string> = {
    KR: "한국",
    US: "미국",
    SG: "싱가포르",
  };

  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
      <header className="border-b border-[var(--border)] bg-[var(--surface)] px-4 py-3 flex items-center gap-4">
        <Link
          href="/"
          className="text-sm text-[var(--muted)] hover:text-[var(--foreground)]"
        >
          ← 홈
        </Link>
        <Link
          href="/dashboard"
          className="text-sm text-[var(--muted)] hover:text-[var(--foreground)]"
        >
          대시보드
        </Link>
        <h1 className="text-lg font-semibold">전체 거래소 목록</h1>
      </header>

      <main className="max-w-3xl mx-auto p-6">
        {loading && (
          <p className="text-[var(--muted)] text-sm">불러오는 중…</p>
        )}
        {error && (
          <div
            className="p-4 rounded border border-[var(--danger)]/50 bg-[var(--danger)]/10 text-sm"
            role="alert"
          >
            {error}
          </div>
        )}
        {!loading && !error && exchanges.length === 0 && (
          <p className="text-[var(--muted)]">등록된 거래소가 없습니다.</p>
        )}
        {!loading && !error && exchanges.length > 0 && (
          <ul className="space-y-3">
            {exchanges.map((ex) => (
              <li
                key={ex.id}
                className="rounded-lg border border-[var(--border)] bg-[var(--surface-card)] p-4 flex flex-wrap items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold">{ex.name}</span>
                    <span className="text-[var(--muted)] text-sm">
                      {ex.nameEn}
                    </span>
                    <span className="text-xs text-[var(--muted)] px-1.5 py-0.5 rounded bg-[var(--surface)]">
                      {countryLabel[ex.country] ?? ex.country}
                    </span>
                    {ex.active && (
                      <span className="text-xs font-medium text-[var(--buy)] px-1.5 py-0.5 rounded bg-[var(--buy)]/15">
                        사용 중
                      </span>
                    )}
                  </div>
                  {ex.defaultMarket && (
                    <p className="text-sm text-[var(--muted)] mt-1">
                      기본 마켓: {ex.defaultMarket}
                    </p>
                  )}
                </div>
                {ex.docsUrl && (
                  <a
                    href={ex.docsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-[var(--buy)] hover:underline shrink-0"
                  >
                    API 문서 →
                  </a>
                )}
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
