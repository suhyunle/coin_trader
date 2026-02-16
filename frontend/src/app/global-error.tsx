"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="ko">
      <body style={{ margin: 0, fontFamily: "ui-monospace, monospace", background: "#0a0a0a", color: "#ededed", padding: 24 }}>
        <h1 style={{ color: "#dc2626" }}>오류가 발생했습니다</h1>
        <p style={{ color: "#737373" }}>{error?.message ?? "알 수 없는 오류"}</p>
        {typeof window !== "undefined" && (error as Error)?.stack && (
          <pre style={{ fontSize: 12, overflow: "auto", maxHeight: 200, background: "#161616", padding: 12, border: "1px solid #262626" }}>
            {(error as Error).stack}
          </pre>
        )}
        <div style={{ marginTop: 16, display: "flex", gap: 12 }}>
          <button
            type="button"
            onClick={() => reset()}
            style={{ padding: "8px 16px", background: "#16a34a", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer" }}
          >
            다시 시도
          </button>
          <a
            href="/dashboard"
            style={{ padding: "8px 16px", border: "1px solid #262626", borderRadius: 4, color: "#ededed", textDecoration: "none" }}
          >
            대시보드로
          </a>
        </div>
      </body>
    </html>
  );
}
