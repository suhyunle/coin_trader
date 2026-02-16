"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("App error:", error);
  }, [error]);

  return (
    <main className="min-h-screen p-8 flex flex-col gap-4 justify-center items-center">
      <h1 className="text-xl font-semibold text-red-500">오류가 발생했습니다</h1>
      <p className="text-muted-foreground text-sm max-w-md text-center">
        {error.message || "알 수 없는 오류입니다."}
      </p>
      {process.env.NODE_ENV === "development" && error.stack && (
        <pre className="text-xs text-left overflow-auto max-h-40 p-3 bg-surface-card rounded border border-surface-border">
          {error.stack}
        </pre>
      )}
      <div className="flex gap-3 mt-4">
        <button
          type="button"
          onClick={() => reset()}
          className="px-4 py-2 rounded bg-[#16a34a] text-white hover:opacity-90"
        >
          다시 시도
        </button>
        <a
          href="/dashboard"
          className="px-4 py-2 rounded border border-surface-border hover:bg-surface-card"
        >
          대시보드로
        </a>
      </div>
    </main>
  );
}
