"use client";
// ↑ 이 파일의 컴포넌트는 브라우저에서 동작하는 "클라이언트 컴포넌트"입니다.

/**
 * 🖥️ game-ui.tsx — 게임 화면 위에 겹쳐지는 글자 UI 모음
 *
 * 게임 그림은 전부 <canvas>에 그리지만, 글자(점수, 타이틀, 게임오버)는
 * 평범한 HTML로 캔버스 "위에" 겹쳐 놓습니다. 왜냐하면:
 *   - HTML 글자는 캔버스 글자보다 또렷하고, 스타일 주기도 훨씬 쉽고,
 *   - 링크(<Link>)나 접근성(스크린 리더) 같은 웹의 장점을 그대로 쓸 수 있거든요.
 *
 * 여기 있는 세 컴포넌트는 전부 "props를 받아서 그리기만 하는" 단순한 부품입니다.
 * 상태(useState)도, 로직도 없어요. 이런 걸 표현 컴포넌트라고 부릅니다.
 *
 * 공통 포인트:
 *   - pointer-events-none: 이 글자층이 손가락 입력을 가로채면 게임 조작이
 *     안 되니까 "터치를 통과시켜라"라고 지정합니다.
 *     (예외: 링크에만 pointer-events-auto를 다시 켜서 클릭 가능하게!)
 *   - -rotate-2 같은 살짝 기울인 글자: 손글씨 낙서 느낌의 비법입니다.
 */

import Link from "next/link";

/** 게임이 지금 어느 화면인지: 타이틀 ↔ 플레이 중 ↔ 게임오버 */
export type Phase = "title" | "playing" | "over";

/** 게임 세계가 React에게 알려주는 "화면에 표시할 정보" 꾸러미. */
export type GameUi = {
  phase: Phase;
  score: number; // 현재 점수
  lives: number; // 남은 하트 (0~3)
  best: number; // 최고 기록
  eaten: number; // 이번 판에 먹은 쓰레기 개수
};

/** ⬆️ 플레이 중 상단에 떠 있는 점수판 + 하트. */
export function Hud({ score, lives }: { score: number; lives: number }) {
  return (
    <div
      className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between px-5"
      // env(safe-area-inset-top): 아이폰 노치(카메라 구멍) 아래로 안전하게 내려주는 CSS 변수
      style={{ paddingTop: "calc(env(safe-area-inset-top) + 10px)" }}
    >
      <div
        className="-rotate-2 text-3xl font-bold leading-none"
        style={{ textShadow: "0 2px 0 rgba(0,0,0,.4)" }}
      >
        점수 <span className="text-[#ffd166]">{score}</span>
      </div>
      <div className="rotate-2 text-3xl leading-none" style={{ textShadow: "0 2px 0 rgba(0,0,0,.4)" }}>
        {/* 하트 3개를 항상 그리되, 남은 목숨보다 뒤의 것은 흐리게(white/20).
            [0, 1, 2].map(...)은 "같은 것을 3번 그려줘"의 React식 표현입니다. */}
        {[0, 1, 2].map((i) => (
          <span key={i} className={i < lives ? "text-[#ff8fab]" : "text-white/20"}>
            ♥
          </span>
        ))}
      </div>
    </div>
  );
}

/** 🚀 시작 화면 (게임 방법 안내). 화면 아무 데나 탭하면 시작돼요. */
export function TitleScreen({ best }: { best: number }) {
  return (
    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-3 px-8 pb-[26vh] text-center">
      <p className="-rotate-3 text-xl text-[#8ecbff]">SPACE JOOPS · 두들 에디션</p>
      <h1
        className="-rotate-2 text-6xl font-bold leading-none text-[#7ee8b2]"
        style={{ textShadow: "0 4px 0 rgba(0,0,0,.45)" }}
      >
        우주 냠냠!
      </h1>
      <p className="mt-2 text-xl leading-8 text-zinc-200">
        손가락으로 슥슥 움직여서
        <br />
        우주쓰레기를 몽땅 먹어치워요 🛰️
        <br />
        <span className="text-[#ff8080]">뾰족뾰족한 애들</span>은 먹으면 배탈나요!
      </p>
      {/* && 패턴: 왼쪽이 참일 때만 오른쪽을 그립니다. 기록이 없으면 아예 표시 안 함 */}
      {best > 0 && <p className="rotate-1 text-lg text-[#ffd166]">최고 기록 {best}점</p>}
      <p className="mt-3 animate-bounce text-2xl font-bold text-[#ffd166]">👆 탭해서 시작!</p>
      <Link
        href="/"
        className="pointer-events-auto mt-5 text-base text-zinc-400 underline underline-offset-4"
      >
        ← 기지로 돌아가기
      </Link>
    </div>
  );
}

/** 😵 게임오버 화면. 결과를 보여주고, 탭하면 다시 시작. */
export function GameOverScreen({ score, best, eaten }: { score: number; best: number; eaten: number }) {
  return (
    // bg-black/35: 반투명 검정을 깔아 뒤의 게임 화면을 살짝 어둡게 → 글자에 집중
    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/35 px-8 text-center">
      <h2
        className="-rotate-2 text-5xl font-bold text-[#ff8fab]"
        style={{ textShadow: "0 3px 0 rgba(0,0,0,.45)" }}
      >
        아이고 배야…
      </h2>
      <p className="mt-1 text-xl text-zinc-200">
        그래도 우주쓰레기 <span className="font-bold text-[#7ee8b2]">{eaten}개</span>를 꿀꺽!
      </p>
      <p className="mt-3 rotate-1 text-4xl font-bold text-[#ffd166]">점수 {score}</p>
      <p className="text-lg text-zinc-300">
        최고 기록 {best}
        {/* 삼항 연산자: 조건 ? 참일때 : 거짓일때 — 신기록이면 축하 문구를 덧붙입니다 */}
        {score >= best && score > 0 ? " · 신기록! 🎉" : ""}
      </p>
      <p className="mt-4 animate-bounce text-2xl font-bold text-[#7ee8b2]">👆 탭해서 다시 도전!</p>
      <Link
        href="/"
        className="pointer-events-auto mt-5 text-base text-zinc-400 underline underline-offset-4"
      >
        ← 기지로 돌아가기
      </Link>
    </div>
  );
}
