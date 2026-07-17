/**
 * 🌍 layout.tsx — 모든 페이지를 감싸는 뿌리(Root) 레이아웃
 *
 * Next.js의 약속: 이 파일의 컴포넌트가 <html>과 <body>를 만들고,
 * 모든 페이지(children)가 그 안에 끼워집니다. 사이트 전체에 적용할
 * 글꼴, 전역 CSS, 기본 메타데이터를 여기서 한 번에 설정해요.
 */

import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css"; // 전역 CSS는 여기서 딱 한 번만 불러옵니다

// next/font: 구글 폰트를 빌드 때 미리 내려받아 우리 서버에서 직접 서빙.
// 화면이 뜬 뒤 글꼴이 바뀌며 덜컹거리는 현상(레이아웃 시프트)이 없어집니다.
// variable 옵션은 이 글꼴을 CSS 변수(--font-geist-sans)로 쓸 수 있게 해줘요.
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// 사이트 전체의 기본 탭 제목/설명 (페이지가 따로 정하면 그쪽이 우선)
export const metadata: Metadata = {
  title: "SPACE JOOPS // 우주 냠냠",
  description: "손가락으로 슥슥. 떠다니는 우주쓰레기를 몽땅 먹어치우는 손그림 두들 게임.",
};

// 모바일 브라우저 상단 바 색 (Next.js 16: metadata가 아니라 viewport로 분리!)
export const viewport: Viewport = {
  themeColor: "#141838",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode; // children = 이 레이아웃 안에 끼워질 각 페이지
}>) {
  return (
    <html
      lang="ko"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {/* 손글씨 글꼴 "Gaegu"(개구쟁이체)는 <link>로 직접 불러옵니다.
            next/font는 이 폰트의 라틴 글자 묶음만 등록할 수 있어서
            정작 필요한 "한글" 글자가 빠지기 때문이에요.
            React 19는 이 <link>를 알아서 <head>로 올려주고 중복도 제거해 줍니다. */}
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font -- 이 검사 규칙은
            Pages Router의 "페이지별 폰트"를 겨냥한 것. 여기는 루트 레이아웃이라
            모든 경로에 적용되므로 규칙을 꺼도 안전합니다. */}
        <link
          rel="stylesheet"
          precedence="default"
          href="https://fonts.googleapis.com/css2?family=Gaegu:wght@400;700&display=swap"
        />
        {children}
      </body>
    </html>
  );
}
