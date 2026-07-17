"use client";
// ↑ localStorage는 브라우저에만 있으므로 클라이언트 컴포넌트여야 합니다.

/**
 * 🏆 best-score.tsx — 첫 화면에 최고 기록을 보여주는 작은 컴포넌트
 *
 * 문제: 이 페이지의 HTML은 서버에서 미리 만들어지는데,
 *       서버에는 localStorage가 없어서 최고 기록을 알 수 없습니다.
 *
 * 해결: useSyncExternalStore 훅을 씁니다. 이 훅은
 *   "React 바깥의 데이터(여기서는 localStorage)를 구독하는" 공식 도구로,
 *   세 가지 함수를 받습니다:
 *     ① subscribe  — "값이 바뀌면 알려줘" 신청 방법
 *     ② loadBest   — 브라우저에서 값을 읽는 방법
 *     ③ 서버 스냅샷 — 서버에서 HTML을 만들 때 임시로 쓸 값 (여기선 0)
 *
 *   서버는 0으로 그려 보내고, 브라우저가 이어받은 뒤(하이드레이션)
 *   진짜 기록으로 다시 그립니다. 다른 탭에서 게임을 해서 기록이 갱신되면
 *   storage 이벤트가 발생해 이 컴포넌트도 자동으로 새 기록을 보여줘요!
 */

import { useSyncExternalStore } from "react";
import { loadBest } from "../lib/storage";

// ① 구독: "storage" 이벤트는 '다른 탭'이 localStorage를 바꿀 때 발생합니다.
//    반환하는 함수는 구독 해제 방법 — React가 정리할 때 사용해요.
const subscribe = (onChange: () => void) => {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
};

// ③ 서버에서 쓸 임시 값: 서버는 기록을 모르니 일단 0.
const serverBest = () => 0;

export default function BestScore() {
  const best = useSyncExternalStore(subscribe, loadBest, serverBest);

  // 기록이 없으면(0이면) 아무것도 그리지 않습니다.
  // null을 반환하면 "여긴 빈칸으로 둬줘"라는 뜻이에요.
  if (!best) return null;

  return (
    <p className="rotate-1 text-lg text-[#ffd166]">
      최고 기록 <span className="font-bold">{best}</span>점 · 깰 수 있어요?
    </p>
  );
}
