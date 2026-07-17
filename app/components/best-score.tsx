"use client";

import { useSyncExternalStore } from "react";
import { BEST_KEY } from "../lib/doodle-art";

// localStorage doesn't exist while rendering on the server, so the value has to arrive
// after hydration. useSyncExternalStore does that without a setState-in-effect cascade,
// and re-reads when another tab plays a round.
const subscribe = (onChange: () => void) => {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
};

const readBest = () => {
  try {
    return localStorage.getItem(BEST_KEY) ?? "0";
  } catch {
    return "0";
  }
};

const serverBest = () => "0";

export default function BestScore() {
  const best = Number(useSyncExternalStore(subscribe, readBest, serverBest)) || 0;

  if (!best) return null;

  return (
    <p className="rotate-1 text-lg text-[#ffd166]">
      최고 기록 <span className="font-bold">{best}</span>점 · 깰 수 있어요?
    </p>
  );
}
