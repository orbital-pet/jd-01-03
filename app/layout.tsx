import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SPACE JOOPS // 우주 냠냠",
  description: "손가락으로 슥슥. 떠다니는 우주쓰레기를 몽땅 먹어치우는 손그림 두들 게임.",
};

export const viewport: Viewport = {
  themeColor: "#141838",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ko"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {/* next/font can't serve Gaegu's Korean glyphs (it registers a latin subset only),
            so link the stylesheet directly. React 19 hoists it into <head> and dedupes it. */}
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font -- the rule targets a per-page
            font in the Pages Router; this lives in the root layout and applies to every route. */}
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
