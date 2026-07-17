"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { createDoodle } from "../lib/doodle";
import {
  BEST_KEY,
  EAT_WORDS,
  JUNK_COLORS,
  OUCH_WORDS,
  type BgStar,
  type Debris,
  type JunkKind,
  type Popup,
  type Spark,
  burst,
  drawBackdrop,
  drawDebris,
  drawMascot,
  drawPopups,
  drawSparks,
  fitCanvas,
  makeDebris,
  makePopup,
  pickEdible,
  seedStars,
  stepDebris,
  stepSwallow,
  updatePopups,
  updateSparks,
} from "../lib/doodle-art";

type Phase = "title" | "playing" | "over";

export default function JoopsGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ui, setUi] = useState({ phase: "title" as Phase, score: 0, lives: 3, best: 0, eaten: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const d = createDoodle(ctx);

    let w = 0;
    let h = 0;
    let raf = 0;
    let last = performance.now();
    let t = 0;

    let phase: Phase = "title";
    let score = 0;
    let lives = 3;
    let eaten = 0;
    let best = 0;
    let overAt = 0;
    let shake = 0;
    let spawnIn = 0.4;
    try {
      best = Number(localStorage.getItem(BEST_KEY)) || 0;
    } catch {}

    const player = {
      x: 0,
      y: 0,
      tx: 0,
      ty: 0,
      r: 24,
      mouth: 0,
      blink: 2.5,
      blinkT: 0,
      invul: 0,
      look: { x: 0, y: 1 },
    };
    let junks: Debris[] = [];
    let popups: Popup[] = [];
    let sparks: Spark[] = [];
    let stars: BgStar[] = [];

    // The canvas runs at 60fps; React only hears about score/lives when they actually change.
    const pushUi = () => setUi({ phase, score, lives, best, eaten });

    // ---------- sound (tiny synth blips) ----------
    let ac: AudioContext | null = null;
    const ensureAudio = () => {
      try {
        if (!ac) ac = new AudioContext();
        if (ac.state === "suspended") void ac.resume(); // browsers only unlock audio inside a gesture
      } catch {}
    };
    const blip = (
      f0: number,
      f1: number,
      dur: number,
      type: OscillatorType = "triangle",
      vol = 0.1,
      delay = 0,
    ) => {
      if (!ac || ac.state !== "running") return;
      const t0 = ac.currentTime + delay;
      const o = ac.createOscillator();
      const g = ac.createGain();
      o.type = type;
      o.frequency.setValueAtTime(f0, t0);
      o.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t0 + dur);
      g.gain.setValueAtTime(vol, t0);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur); // exponential ramps can never reach 0
      o.connect(g);
      g.connect(ac.destination);
      o.start(t0);
      o.stop(t0 + dur + 0.05);
    };
    const sfx = {
      eat: () => blip(430, 900, 0.09, "triangle", 0.12), // rising = good
      star: () => {
        blip(660, 660, 0.08, "sine");
        blip(880, 880, 0.08, "sine", 0.1, 0.08);
        blip(1320, 1320, 0.14, "sine", 0.1, 0.16);
      },
      hit: () => blip(220, 65, 0.28, "sawtooth", 0.12), // falling + rough = bad
      over: () => {
        blip(392, 392, 0.16, "triangle");
        blip(330, 330, 0.16, "triangle", 0.1, 0.18);
        blip(262, 130, 0.5, "triangle", 0.1, 0.36);
      },
    };
    const buzz = (ms: number) => {
      try {
        navigator.vibrate?.(ms);
      } catch {}
    };

    // ---------- game actions ----------
    const spawn = () => {
      const difficulty = Math.min(1, score / 400);
      const roll = Math.random();
      let kind: JunkKind;
      if (roll < 0.07) kind = "star";
      else if (phase === "playing" && roll < 0.17 + difficulty * 0.13) kind = "hazard";
      else kind = pickEdible();
      const size = kind === "star" ? 15 : kind === "hazard" ? 16 + Math.random() * 8 : 13 + Math.random() * 6;
      const vy = (55 + Math.random() * 45) * (1 + difficulty * 1.1) * (phase === "playing" ? 1 : 0.6);
      junks.push(makeDebris(kind, w, size, vy));
    };

    const swallow = (j: Debris) => {
      if (j.kind === "star") {
        score += 40;
        sfx.star();
        if (lives < 3) {
          lives++;
          popups.push(makePopup(player.x, player.y - player.r - 18, "+♥", "#ff8fab", 30));
        } else {
          popups.push(makePopup(player.x, player.y - player.r - 18, "+40!", JUNK_COLORS.star, 27));
        }
      } else {
        score += 10;
        eaten++;
        sfx.eat();
        const word = EAT_WORDS[Math.floor(Math.random() * EAT_WORDS.length)];
        popups.push(makePopup(player.x, player.y - player.r - 16, word, "#ffffff", 24));
      }
      buzz(12);
      burst(sparks, player.x, player.y + player.r * 0.4, JUNK_COLORS[j.kind], 7);
      player.r = Math.min(38, player.r + 0.45); // eating makes you bigger, which makes eating easier
      pushUi();
    };

    const gameOver = () => {
      phase = "over";
      overAt = t;
      if (score > best) {
        best = score;
        try {
          localStorage.setItem(BEST_KEY, String(best));
        } catch {}
      }
      sfx.over();
      pushUi();
    };

    const hit = (j: Debris) => {
      lives--;
      player.invul = 1.4; // without i-frames one spike drains all three hearts in a few frames
      shake = 0.35;
      player.r = Math.max(24, player.r - 3);
      sfx.hit();
      buzz(90);
      burst(sparks, j.x, j.y, JUNK_COLORS.hazard, 10);
      const word = OUCH_WORDS[Math.floor(Math.random() * OUCH_WORDS.length)];
      popups.push(makePopup(player.x, player.y - player.r - 18, word, JUNK_COLORS.hazard, 26));
      if (lives <= 0) gameOver();
      else pushUi();
    };

    const start = () => {
      phase = "playing";
      score = 0;
      lives = 3;
      eaten = 0;
      player.r = 24;
      player.invul = 0;
      player.mouth = 0;
      player.x = w / 2;
      player.y = h * 0.62;
      player.tx = player.x;
      player.ty = player.y;
      junks = [];
      popups = [];
      sparks = [];
      spawnIn = 0.4;
      shake = 0;
      pushUi();
    };

    // ---------- simulation ----------
    const update = (dt: number) => {
      spawnIn -= dt;
      if (spawnIn <= 0) {
        spawn();
        const base = phase === "playing" ? Math.max(0.42, 1.05 - score / 900) : 1.5;
        spawnIn = base * (0.7 + Math.random() * 0.6); // jitter the cadence so it can't be memorised
      }

      if (phase === "playing") {
        const k = Math.min(1, dt * 7);
        player.x += (player.tx - player.x) * k;
        player.y += (player.ty - player.y) * k;
      } else {
        const k = Math.min(1, dt * 2);
        player.x += (w / 2 - player.x) * k;
        player.y += (h * 0.68 + Math.sin(t * 1.8) * 10 - player.y) * k;
      }
      player.invul = Math.max(0, player.invul - dt);

      player.blink -= dt;
      if (player.blink <= 0) {
        player.blink = 2.2 + Math.random() * 2.5;
        player.blinkT = 0.13;
      }
      player.blinkT = Math.max(0, player.blinkT - dt);

      let nearest = Infinity;
      let nearestJunk: Debris | null = null;
      for (const j of junks) {
        if (j.eatT >= 0 || j.kind === "hazard") continue;
        const dist = Math.hypot(j.x - player.x, j.y - player.y);
        if (dist < nearest) {
          nearest = dist;
          nearestJunk = j;
        }
      }
      const wantOpen = phase === "playing" && nearestJunk && nearest < player.r + 120 ? 1 : 0;
      player.mouth += (wantOpen - player.mouth) * Math.min(1, dt * 8);
      if (nearestJunk) {
        const dx = nearestJunk.x - player.x;
        const dy = nearestJunk.y - player.y;
        const dd = Math.hypot(dx, dy) || 1;
        player.look.x += (dx / dd - player.look.x) * Math.min(1, dt * 6);
        player.look.y += (dy / dd - player.look.y) * Math.min(1, dt * 6);
      }

      const mouthX = player.x;
      const mouthY = player.y + player.r * 0.4;

      for (let i = junks.length - 1; i >= 0; i--) {
        const j = junks[i];
        if (j.eatT >= 0) {
          stepSwallow(j, dt, mouthX, mouthY);
          if (j.eatT >= 1) {
            junks.splice(i, 1);
            swallow(j);
          }
          continue;
        }
        stepDebris(j, dt);
        if (j.y > h + 70) {
          junks.splice(i, 1);
          continue;
        }
        if (phase !== "playing") continue;

        const dist = Math.hypot(j.x - player.x, j.y - player.y);
        if (j.kind === "hazard") {
          // hitbox is well inside the spikes — a graze should never kill
          if (player.invul <= 0 && dist < player.r + j.size * 0.75) {
            junks.splice(i, 1);
            hit(j);
          }
        } else {
          // gentle magnet: finger-precision aiming is impossible on a phone
          if (dist < player.r + 70) {
            const pull = Math.min(1, dt * 3);
            j.x0 += (player.x - j.x) * pull; // x0, not x — x is rebuilt from x0 every step
            j.y += (player.y - j.y) * pull;
          }
          if (dist < player.r + j.size * 0.65 + player.mouth * 10) j.eatT = 0;
        }
      }

      updatePopups(popups, dt);
      updateSparks(sparks, dt);
      shake = Math.max(0, shake - dt);
    };

    // ---------- drawing ----------
    const draw = () => {
      d.setPhase(Math.floor(t * 7)); // 7 redraws/sec of jitter = hand-drawn "boiling" lines
      ctx.save();
      if (shake > 0) {
        const a = (shake / 0.35) * 7;
        ctx.translate((Math.random() - 0.5) * a, (Math.random() - 0.5) * a);
      }
      drawBackdrop(ctx, d, w, h, t, stars);
      for (const j of junks) drawDebris(ctx, d, j, t);

      ctx.save();
      if (player.invul > 0 && Math.floor(t * 16) % 2 === 0) ctx.globalAlpha = 0.4;
      drawMascot(ctx, d, {
        x: player.x,
        y: player.y,
        r: player.r,
        t,
        mouth: player.mouth,
        blinkT: player.blinkT,
        lookX: player.look.x,
        lookY: player.look.y,
      });
      ctx.restore();

      drawSparks(ctx, sparks);
      drawPopups(ctx, d, popups);
      ctx.restore();
    };

    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000); // clamp: a backgrounded tab must not teleport junk
      last = now;
      t += dt;
      update(dt);
      draw();
      raf = requestAnimationFrame(loop);
    };

    // ---------- input & sizing ----------
    const setTarget = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      const px = e.clientX - rect.left;
      // a fingertip covers the mascot, so hold it above the touch point; a cursor doesn't
      const py = e.clientY - rect.top - (e.pointerType === "touch" ? 72 : 0);
      player.tx = Math.min(Math.max(px, player.r + 6), w - player.r - 6);
      player.ty = Math.min(Math.max(py, player.r + 64), h - player.r - 10);
    };
    const onDown = (e: PointerEvent) => {
      e.preventDefault();
      ensureAudio();
      if (phase === "title") start();
      else if (phase === "over") {
        if (t - overAt < 0.6) return; // ignore the finger that was still down when you died
        start();
      }
      setTarget(e);
    };
    const onMove = (e: PointerEvent) => setTarget(e);

    const resize = () => {
      ({ w, h } = fitCanvas(canvas, ctx));
      stars = seedStars(w, h, 46);
      if (!player.x) {
        player.x = w / 2;
        player.y = h * 0.68;
        player.tx = player.x;
        player.ty = player.y;
      }
    };

    resize();
    pushUi();
    window.addEventListener("resize", resize);
    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      if (ac) void ac.close().catch(() => {});
    };
  }, []);

  return (
    <div
      className="fixed inset-0 select-none overflow-hidden bg-[#141838] text-zinc-100"
      style={{ WebkitTouchCallout: "none" }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* touch-none: without it the browser claims the drag as a scroll and pointermove stops firing */}
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full touch-none" />

      {ui.phase !== "title" && (
        <div
          className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between px-5"
          style={{ paddingTop: "calc(env(safe-area-inset-top) + 10px)" }}
        >
          <div
            className="-rotate-2 text-3xl font-bold leading-none"
            style={{ textShadow: "0 2px 0 rgba(0,0,0,.4)" }}
          >
            점수 <span className="text-[#ffd166]">{ui.score}</span>
          </div>
          <div className="rotate-2 text-3xl leading-none" style={{ textShadow: "0 2px 0 rgba(0,0,0,.4)" }}>
            {[0, 1, 2].map((i) => (
              <span key={i} className={i < ui.lives ? "text-[#ff8fab]" : "text-white/20"}>
                ♥
              </span>
            ))}
          </div>
        </div>
      )}

      {ui.phase === "title" && (
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
          {ui.best > 0 && <p className="rotate-1 text-lg text-[#ffd166]">최고 기록 {ui.best}점</p>}
          <p className="mt-3 animate-bounce text-2xl font-bold text-[#ffd166]">👆 탭해서 시작!</p>
          <Link
            href="/"
            className="pointer-events-auto mt-5 text-base text-zinc-400 underline underline-offset-4"
          >
            ← 기지로 돌아가기
          </Link>
        </div>
      )}

      {ui.phase === "over" && (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/35 px-8 text-center">
          <h2
            className="-rotate-2 text-5xl font-bold text-[#ff8fab]"
            style={{ textShadow: "0 3px 0 rgba(0,0,0,.45)" }}
          >
            아이고 배야…
          </h2>
          <p className="mt-1 text-xl text-zinc-200">
            그래도 우주쓰레기 <span className="font-bold text-[#7ee8b2]">{ui.eaten}개</span>를 꿀꺽!
          </p>
          <p className="mt-3 rotate-1 text-4xl font-bold text-[#ffd166]">점수 {ui.score}</p>
          <p className="text-lg text-zinc-300">
            최고 기록 {ui.best}
            {ui.score >= ui.best && ui.score > 0 ? " · 신기록! 🎉" : ""}
          </p>
          <p className="mt-4 animate-bounce text-2xl font-bold text-[#7ee8b2]">👆 탭해서 다시 도전!</p>
          <Link
            href="/"
            className="pointer-events-auto mt-5 text-base text-zinc-400 underline underline-offset-4"
          >
            ← 기지로 돌아가기
          </Link>
        </div>
      )}
    </div>
  );
}
