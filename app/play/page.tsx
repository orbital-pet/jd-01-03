/**
 * 🕹️ play/page.tsx — 게임 페이지 (주소: /play)
 *
 * 이 파일은 서버 컴포넌트라서 두 가지 일만 합니다:
 *   ① 이 페이지의 메타데이터(탭 제목, 뷰포트 설정)를 내보내고
 *   ② 실제 게임(클라이언트 컴포넌트)을 화면에 올립니다.
 *
 * "페이지 껍데기는 서버, 움직이는 속은 클라이언트" — Next.js의 기본 요리법이에요.
 */

import type { Metadata, Viewport } from "next";
import JoopsGame from "./joops-game";

// 브라우저 탭 제목과 설명. Next.js가 <head>에 알아서 넣어줍니다.
export const metadata: Metadata = {
  title: "SPACE JOOPS // 우주 냠냠",
  description: "손가락으로 우주쓰레기를 냠냠 먹어치우는 두들 게임.",
};

// 📱 모바일 화면 설정. (Next.js 16에서는 metadata와 "따로" 내보내야 합니다!)
export const viewport: Viewport = {
  width: "device-width", // 기기 실제 폭에 맞추기
  initialScale: 1,
  maximumScale: 1, // 확대 금지 +
  userScalable: false, // 핀치 줌 금지 — 게임 중 두 손가락에 화면이 확대되면 재앙!
  viewportFit: "cover", // 노치(카메라 구멍) 영역까지 배경을 채움
  themeColor: "#141838", // 안드로이드 상단 바 색까지 우주색으로 → 몰입감
};

export default function Play() {
  return <JoopsGame />;
}
