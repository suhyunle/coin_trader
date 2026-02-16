import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BTC/KRW 트레이딩",
  description: "5분봉 롱전용 트레이딩 시스템",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
