import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen p-8 flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">BTC/KRW 트레이딩</h1>
      <p className="text-neutral-400">5분봉 롱전용 트레이딩 시스템 — 프론트 대시보드 (Next.js)</p>
      <div className="flex flex-col gap-2 w-fit">
        <Link href="/dashboard" className="text-buy hover:underline">
          → 대시보드 (차트 + 우측 패널 + 이벤트 타임라인)
        </Link>
        <Link href="/exchanges" className="text-buy hover:underline">
          → 전체 거래소 목록
        </Link>
      </div>
    </main>
  );
}
