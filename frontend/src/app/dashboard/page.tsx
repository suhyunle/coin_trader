"use client";

import dynamic from "next/dynamic";

const DashboardView = dynamic(
  () => import("./DashboardView"),
  {
    ssr: false,
    loading: () => (
      <div
        className="min-h-screen flex items-center justify-center font-mono text-[#ededed]"
        style={{ background: "#0a0a0a" }}
      >
        로딩 중…
      </div>
    ),
  }
);

export default function DashboardPage() {
  return <DashboardView />;
}
