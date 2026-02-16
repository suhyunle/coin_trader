"use client";

import { useEffect, useRef } from "react";
import type { CandleDto } from "@/types/api";

interface ChartSectionProps {
  candles: CandleDto[];
  lastPrice?: number;
  trend?: "Up" | "Down" | "Side";
  atr?: number;
  spreadBps?: number;
  tradeAllowed?: boolean;
}

export default function ChartSection({
  candles,
  lastPrice = 0,
  trend = "Side",
  atr = 0,
  spreadBps = 0,
  tradeAllowed = true,
}: ChartSectionProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<{ remove: () => void } | null>(null);

  useEffect(() => {
    if (!chartRef.current || candles.length === 0) return;

    let cancelled = false;
    void import("lightweight-charts").then((mod) => {
      if (cancelled || !chartRef.current) return;
      const { createChart } = mod;
      const chart = createChart(chartRef.current, {
        layout: {
          background: { color: "#0f0f0f" },
          textColor: "#737373",
        },
        grid: { vertLines: { color: "#262626" }, horzLines: { color: "#262626" } },
        width: chartRef.current.clientWidth,
        height: 360,
        timeScale: { timeVisible: true, secondsVisible: false },
        rightPriceScale: { borderColor: "#262626" },
      });

      const series = chart.addCandlestickSeries({
        upColor: "#16a34a",
        downColor: "#ea580c",
        borderVisible: false,
      });

      const data = candles.map((c) => ({
        time: Math.floor(c.timestamp / 1000),
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      }));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      series.setData(data as any);
      chart.timeScale().fitContent();
      chartInstance.current = chart;
    });

    return () => {
      cancelled = true;
      if (chartInstance.current) {
        chartInstance.current.remove();
        chartInstance.current = null;
      }
    };
  }, [candles]);

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* 미니바: 현재가(참고), Trend, ATR, Spread, Trade Allowed — 가격과 구분되게 라벨 명시 */}
      <div className="flex items-center gap-6 py-2 px-3 border-b border-surface-border text-xs tabular-nums flex-wrap">
        {lastPrice > 0 && (
          <>
            <span className="text-muted">차트 기준가</span>
            <span className="text-foreground font-medium">{lastPrice.toLocaleString("ko-KR", { maximumFractionDigits: 0 })} 원</span>
          </>
        )}
        <span className="text-muted">Trend</span>
        <span
          className={
            trend === "Up" ? "text-buy" : trend === "Down" ? "text-sell" : "text-muted"
          }
        >
          {trend}
        </span>
        <span className="text-muted" title="ATR: 평균 진폭 (변동성 지표, 가격 아님)">
          ATR
        </span>
        <span className="text-foreground" title="평균 진폭 (변동성)">
          {atr > 0 ? atr.toLocaleString("ko-KR", { maximumFractionDigits: 0 }) : "—"} 원
        </span>
        <span className="text-muted">Spread</span>
        <span className="text-foreground">{spreadBps > 0 ? `${spreadBps.toFixed(1)} bps` : "—"}</span>
        <span className="text-muted">Trade Allowed</span>
        <span className={tradeAllowed ? "text-buy" : "text-danger"}>{tradeAllowed ? "✅" : "❌"}</span>
      </div>
      {/* 차트 영역 */}
      <div ref={chartRef} className="flex-1 min-h-[280px]" />
    </div>
  );
}
