import Link from "next/link";

export default function NotFound() {
  return (
    <main className="min-h-screen p-8 flex flex-col gap-4 justify-center items-center">
      <h1 className="text-2xl font-semibold">페이지를 찾을 수 없습니다</h1>
      <p className="text-neutral-400">요청한 URL이 없거나 이동되었을 수 있습니다.</p>
      <div className="flex gap-4 mt-4">
        <Link
          href="/dashboard"
          className="px-4 py-2 rounded bg-[#16a34a] text-white hover:opacity-90"
        >
          대시보드로 이동
        </Link>
        <Link href="/" className="px-4 py-2 rounded border border-[#262626] hover:bg-[#161616]">
          홈
        </Link>
      </div>
    </main>
  );
}
