/**
 * 🏠 page.tsx — 첫 화면 (주소: / )
 *
 * Next.js의 약속: app 폴더 안의 page.tsx가 곧 그 주소의 페이지가 됩니다.
 *   app/page.tsx      →  /        (이 파일)
 *   app/play/page.tsx →  /play    (게임 화면)
 *
 * 이 파일에는 "use client"가 없습니다 = 서버 컴포넌트.
 * 상태도 이벤트도 없는 정적인 소개 화면이라 서버에서 HTML만 만들어 보내면 충분하고,
 * 그만큼 브라우저가 내려받는 JS가 줄어듭니다.
 * 움직임이 필요한 부분(배경 애니메이션, 최고 기록)만
 * 클라이언트 컴포넌트(DoodleSky, BestScore)를 끼워 넣었어요.
 */

import Link from "next/link";
import BestScore from "./components/best-score";
import DoodleSky from "./components/doodle-sky";

// 게임 규칙 안내. 이렇게 데이터로 빼두면 규칙이 늘어도 JSX는 안 바꿔도 됩니다.
const RULES = [
  { color: "#8ecbff", text: "쓰레기 냠냠 +10" },
  { color: "#ffd166", text: "별은 +40" },
  { color: "#ff8080", text: "가시는 아야!" },
];

export default function Home() {
  return (
    // select-none: 글자가 드래그로 파랗게 선택되는 것 방지 (게임 소개 화면이니까)
    <div className="relative flex flex-1 flex-col overflow-hidden bg-[#141838] text-zinc-100 select-none">
      {/* 배경 전체를 덮는 캔버스 애니메이션 (z-index가 낮아 글자 뒤에 깔림) */}
      <DoodleSky />

      <header className="relative z-10 flex items-center justify-between px-5 py-3 text-base text-zinc-500">
        <span>🛰️ 궤도 청소 대작전</span>
        {/* hidden sm:inline — 평소엔 숨기고, 화면이 sm(640px) 이상일 때만 표시 */}
        <span className="hidden sm:inline">2061년 · 지구 저궤도</span>
      </header>

      {/* pb-[30vh]: 아래쪽 30%를 비워 둡니다 — 그 띠가 마스코트의 놀이터거든요.
          textShadow: 쓰레기가 글자 뒤로 지나가도 글자가 잘 읽히게 하는 그림자. */}
      <main
        className="relative z-10 mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-3 px-6 pb-[30vh] text-center"
        style={{ textShadow: "0 2px 10px rgba(10,12,30,0.95)" }}
      >
        {/* -rotate-3: 살짝 기울인 글자 = 손글씨 낙서 느낌의 핵심 비법 */}
        <p className="-rotate-3 text-xl text-[#8ecbff]">SPACE JOOPS · 두들 에디션</p>

        <h1
          className="-rotate-2 text-6xl font-bold leading-none text-[#7ee8b2] sm:text-7xl"
          style={{ textShadow: "0 4px 0 rgba(0,0,0,.45)" }}
        >
          우주 냠냠!
        </h1>

        <p className="mt-1 text-xl leading-8 text-zinc-200">
          하늘에 떠다니는 <span className="text-[#ffd166]">8,000톤</span>짜리 쓰레기 구름.
          <br />
          입 큰 친구가 전부 먹어치우러 갑니다.
        </p>

        {/* 규칙 목록: 배열.map()으로 데이터를 화면 조각으로 변환하는 React의 기본기.
            key는 React가 목록의 각 줄을 구분하는 이름표 — 목록에는 꼭 필요해요. */}
        <ul className="mt-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-lg text-zinc-300">
          {RULES.map((r) => (
            <li key={r.text} className="flex items-center gap-1.5">
              {/* aria-hidden: 색깔 점은 장식이니 스크린 리더는 건너뛰게 */}
              <span
                aria-hidden="true"
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ background: r.color }}
              />
              {r.text}
            </li>
          ))}
        </ul>

        {/* Link: <a>의 Next.js 버전. 페이지 전체 새로고침 없이 /play로 이동합니다.
            doodle-box(삐뚤빼뚤 테두리)와 animate-wiggle(갸우뚱갸우뚱)은
            globals.css에 정의된 우리만의 클래스예요. */}
        <Link
          href="/play"
          className="doodle-box animate-wiggle mt-4 inline-flex items-center gap-2 border-[3px] border-[#7ee8b2] bg-[#7ee8b2]/15 px-9 py-2 text-3xl font-bold text-[#7ee8b2] transition-transform hover:scale-105 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#7ee8b2]"
        >
          <span aria-hidden="true">▶</span> 게임 시작!
        </Link>

        {/* 최고 기록 (localStorage에서 읽는 클라이언트 컴포넌트) */}
        <BestScore />
      </main>

      <footer className="relative z-10 flex items-center justify-between px-5 py-3 text-sm text-zinc-600">
        <span>v0.1.0 · 손으로 그린 우주</span>
        <span className="hidden sm:inline">쓰다듬으면 따라와요</span>
      </footer>
    </div>
  );
}
