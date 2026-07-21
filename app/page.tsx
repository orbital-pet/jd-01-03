import Link from "next/link";
import BestScore from "./components/best-score";
import DoodleSky from "./components/doodle-sky";

const RULES = [
  { color: "#8ecbff", text: "눌러 끌면 분사" },
  { color: "#7ee8b2", text: "잔해 주워 kg" },
  { color: "#66fcf1", text: "연료 셀로 재점화" },
  { color: "#ff8080", text: "가시는 연료 -" },
];

export default function Home() {
  return (
    <div className="relative flex flex-1 flex-col overflow-hidden bg-[#141838] text-zinc-100 select-none">
      <DoodleSky />

      <header className="relative z-10 flex items-center justify-between px-5 py-3 text-base text-zinc-500">
        <span>🛰️ 궤도 청소 대작전</span>
        <span className="hidden sm:inline">2061년 · 지구 저궤도</span>
      </header>

      {/* pb leaves the bottom strip empty — that's the mascot's playground.
          The shadow keeps the copy readable when junk drifts behind it. */}
      <main
        className="relative z-10 mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-3 px-6 pb-[30vh] text-center"
        style={{ textShadow: "0 2px 10px rgba(10,12,30,0.95)" }}
      >
        <p className="-rotate-3 text-xl text-[#8ecbff]">SPACE JOOPS · 두들 에디션</p>

        <h1
          className="-rotate-2 text-6xl font-bold leading-none text-[#7ee8b2] sm:text-7xl"
          style={{ textShadow: "0 4px 0 rgba(0,0,0,.45)" }}
        >
          우주 냠냠!
        </h1>

        <p className="mt-1 text-xl leading-8 text-zinc-200">
          궤도에 떠다니는 <span className="text-[#ffd166]">8,000톤</span>짜리 쓰레기 구름.
          <br />
          조그셔틀을 조종해 전부 수거하러 갑니다.
        </p>

        <ul className="mt-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-lg text-zinc-300">
          {RULES.map((r) => (
            <li key={r.text} className="flex items-center gap-1.5">
              <span
                aria-hidden="true"
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ background: r.color }}
              />
              {r.text}
            </li>
          ))}
        </ul>

        <Link
          href="/play"
          className="doodle-box animate-wiggle mt-4 inline-flex items-center gap-2 border-[3px] border-[#7ee8b2] bg-[#7ee8b2]/15 px-9 py-2 text-3xl font-bold text-[#7ee8b2] transition-transform hover:scale-105 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#7ee8b2]"
        >
          <span aria-hidden="true">▶</span> 게임 시작!
        </Link>

        <BestScore />
      </main>

      <footer className="relative z-10 flex items-center justify-between px-5 py-3 text-sm text-zinc-600">
        <span>v0.1.0 · 손으로 그린 우주</span>
        <span className="hidden sm:inline">눌러 끌면 날아가요</span>
      </footer>
    </div>
  );
}
