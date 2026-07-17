"use client";
// ↑ 캔버스와 이벤트를 쓰므로 브라우저에서 실행되는 클라이언트 컴포넌트입니다.

/**
 * 🌠 doodle-sky.tsx — 첫 화면(랜딩 페이지)의 배경 애니메이션
 *
 * 오락실 게임기가 아무도 안 할 때 혼자 시연 화면을 트는 것처럼,
 * 주인공이 화면 아래쪽 띠 안에서 "혼자" 게임을 합니다:
 * 쓰레기를 쫓아다니고, 가시를 피하고… 그리고 마우스/손가락을 올리면
 * 먹이보다 당신을 따라옵니다. 첫 화면 자체가 게임의 데모인 셈이죠.
 *
 * 구조는 본편(joops-game.tsx)과 같은 "게임 루프"지만,
 * 점수도 목숨도 없는 단순화 버전입니다. 본편을 이해했다면 여기는 술술 읽혀요.
 */

import { useEffect, useRef } from "react";
import { createDoodle } from "../lib/doodle";
import { EAT_WORDS, JUNK_COLORS, OUCH_WORDS, type JunkKind, pickEdible } from "../lib/constants";
import { type BgStar, drawBackdrop, seedStars } from "../lib/backdrop";
import { type Debris, drawDebris, makeDebris, stepDebris, stepSwallow } from "../lib/debris";
import { drawMascot } from "../lib/mascot";
import {
  type Popup,
  type Spark,
  burst,
  drawPopups,
  drawSparks,
  makePopup,
  updatePopups,
  updateSparks,
} from "../lib/effects";
import { fitCanvas } from "../lib/canvas";

export default function DoodleSky() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const d = createDoodle(ctx);

    // ── 상태 변수들 (본편과 같은 패턴: 전부 클로저 속 지역 변수) ──
    let w = 0;
    let h = 0;
    let raf = 0;
    let last = performance.now();
    let t = 0;
    let spawnIn = 0.6;

    // 주인공. 본편의 player보다 단순합니다 (점수/무적 대신 hurt만).
    const hero = {
      x: 0,
      y: 0,
      r: 26,
      mouth: 0,
      blink: 2,
      blinkT: 0,
      hurt: 0, // 가시에 찔린 뒤 깜빡이는 시간
      look: { x: 0, y: 1 },
    };
    const junks: Debris[] = [];
    const popups: Popup[] = [];
    const sparks: Spark[] = [];
    let stars: BgStar[] = [];

    // 마우스/손가락이 마지막으로 있던 곳. until 시각까지는 먹이보다 이쪽이 우선!
    const lure = { x: 0, y: 0, until: -1 };

    // 주인공의 활동 구역: 화면 아래쪽 띠.
    // 위로 올라가면 제목 글자를 가리니까 여기 가둬 둡니다.
    const band = () => ({ lo: h * 0.7, hi: h - 56 });

    /** 쓰레기 등장 (본편보다 느긋한 페이스, 가시 20%). */
    const spawn = () => {
      const roll = Math.random();
      const kind: JunkKind = roll < 0.08 ? "star" : roll < 0.2 ? "hazard" : pickEdible();
      const size = kind === "star" ? 15 : kind === "hazard" ? 16 + Math.random() * 6 : 13 + Math.random() * 6;
      junks.push(makeDebris(kind, w, size, 42 + Math.random() * 34));
    };

    const update = (dt: number) => {
      // 스폰 타이머 (카운트다운 방식)
      spawnIn -= dt;
      if (spawnIn <= 0) {
        spawn();
        spawnIn = 1.1 + Math.random() * 0.9;
      }

      const { lo, hi } = band();
      const clampY = (y: number) => Math.min(Math.max(y, lo), hi); // 띠 안에 가두기

      // 눈 깜빡임 + 아픔 타이머
      hero.blink -= dt;
      if (hero.blink <= 0) {
        hero.blink = 2.2 + Math.random() * 2.5;
        hero.blinkT = 0.13;
      }
      hero.blinkT = Math.max(0, hero.blinkT - dt);
      hero.hurt = Math.max(0, hero.hurt - dt);

      // ── 주인공의 아주 작은 "인공지능" ──
      // 제일 가까운 먹이(prey)와 제일 가까운 가시(spike)를 각각 찾습니다.
      let prey: Debris | null = null;
      let preyD = Infinity;
      let spike: Debris | null = null;
      let spikeD = Infinity;
      for (const j of junks) {
        if (j.eatT >= 0) continue;
        const dist = Math.hypot(j.x - hero.x, j.y - hero.y);
        if (j.kind === "hazard") {
          if (dist < spikeD) {
            spikeD = dist;
            spike = j;
          }
        } else if (j.y > h * 0.3 && dist < preyD) {
          // j.y > h * 0.3: 너무 높이 있는 먹이는 무시 (제목 쪽을 넘보지 않게)
          preyD = dist;
          prey = j;
        }
      }

      // 목표 정하기 — 우선순위: ① 커서(lure) → ② 먹이 → ③ 심심한 좌우 산책
      let tx: number;
      let ty: number;
      if (t < lure.until) {
        tx = lure.x;
        ty = clampY(lure.y);
      } else if (prey) {
        tx = prey.x;
        ty = clampY(prey.y);
      } else {
        // 쫓을 게 없어도 sin으로 살랑살랑 떠다녀서 절대 가만히 있지 않습니다.
        tx = w / 2 + Math.sin(t * 0.5) * w * 0.14;
        ty = lo + 24 + Math.sin(t * 1.3) * 6;
      }
      if (spike && spikeD < 96) {
        tx += (hero.x - spike.x) * 1.4; // 가시 반대쪽으로 목표를 밀어 슬쩍 피함
      }
      // 목표를 향해 부드럽게 이동 (지수 감쇠 — 본편과 같은 공식)
      const k = Math.min(1, dt * 3.2);
      hero.x += (Math.min(Math.max(tx, hero.r + 8), w - hero.r - 8) - hero.x) * k;
      hero.y += (clampY(ty) - hero.y) * k;

      // 입 벌리기 + 시선 처리 (본편과 동일한 로직)
      const wantOpen = prey && preyD < hero.r + 110 ? 1 : 0;
      hero.mouth += (wantOpen - hero.mouth) * Math.min(1, dt * 8);
      const gaze = prey ?? spike; // ?? : 먹이가 없으면(null이면) 가시라도 쳐다봄
      if (gaze) {
        const dx = gaze.x - hero.x;
        const dy = gaze.y - hero.y;
        const dd = Math.hypot(dx, dy) || 1;
        hero.look.x += (dx / dd - hero.look.x) * Math.min(1, dt * 6);
        hero.look.y += (dy / dd - hero.look.y) * Math.min(1, dt * 6);
      }

      const mouthX = hero.x;
      const mouthY = hero.y + hero.r * 0.4;

      // 쓰레기 갱신 + 충돌 (역순 순회 — 삭제하면서 돌기 때문)
      for (let i = junks.length - 1; i >= 0; i--) {
        const j = junks[i];
        if (j.eatT >= 0) {
          stepSwallow(j, dt, mouthX, mouthY);
          if (j.eatT >= 1) {
            junks.splice(i, 1);
            // 점수는 없지만 팝업과 반짝이는 본편처럼 보여줍니다.
            const word =
              j.kind === "star" ? "+40!" : EAT_WORDS[Math.floor(Math.random() * EAT_WORDS.length)];
            const color = j.kind === "star" ? JUNK_COLORS.star : "#ffffff";
            popups.push(makePopup(hero.x, hero.y - hero.r - 16, word, color, 24));
            burst(sparks, mouthX, mouthY, JUNK_COLORS[j.kind], 7);
            hero.r = Math.min(32, hero.r + 0.5);
          }
          continue;
        }
        stepDebris(j, dt);
        if (j.y > h + 70) {
          junks.splice(i, 1);
          continue;
        }

        const dist = Math.hypot(j.x - hero.x, j.y - hero.y);
        if (j.kind === "hazard") {
          if (hero.hurt <= 0 && dist < hero.r + j.size * 0.75) {
            junks.splice(i, 1);
            hero.hurt = 1.2;
            const word = OUCH_WORDS[Math.floor(Math.random() * OUCH_WORDS.length)];
            popups.push(makePopup(hero.x, hero.y - hero.r - 18, word, JUNK_COLORS.hazard, 26));
            burst(sparks, j.x, j.y, JUNK_COLORS.hazard, 10);
          }
        } else {
          // 자석 + 먹기 시작 (본편과 동일 — x가 아니라 x0를 당기는 것에 주의!)
          if (dist < hero.r + 60) {
            const pull = Math.min(1, dt * 3);
            j.x0 += (hero.x - j.x) * pull;
            j.y += (hero.y - j.y) * pull;
          }
          if (dist < hero.r + j.size * 0.7 + hero.mouth * 10) j.eatT = 0;
        }
      }

      // 먹어서 커진 몸이 천천히 원래 크기(26)로 소화되어 돌아옵니다.
      hero.r += (26 - hero.r) * Math.min(1, dt * 0.35);
      updatePopups(popups, dt);
      updateSparks(sparks, dt);
    };

    const draw = () => {
      d.setPhase(Math.floor(t * 7)); // 손그림 "끓는 선" 장면 번호 (초당 7번)
      drawBackdrop(ctx, d, w, h, t, stars);
      for (const j of junks) drawDebris(ctx, d, j, t);

      ctx.save();
      if (hero.hurt > 0 && Math.floor(t * 16) % 2 === 0) ctx.globalAlpha = 0.4; // 아야 깜빡임
      drawMascot(ctx, d, {
        x: hero.x,
        y: hero.y,
        r: hero.r,
        t,
        mouth: hero.mouth,
        blinkT: hero.blinkT,
        lookX: hero.look.x,
        lookY: hero.look.y,
      });
      ctx.restore();

      drawSparks(ctx, sparks);
      drawPopups(ctx, d, popups);
    };

    // 게임 루프 (본편과 동일한 구조: dt 계산 → update → draw → 다음 예약)
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      t += dt;
      update(dt);
      draw();
      raf = requestAnimationFrame(loop);
    };

    // 이 캔버스는 pointer-events:none이라(버튼 클릭을 막지 않으려고)
    // 캔버스가 아닌 window에서 포인터 움직임을 듣습니다.
    const onMove = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      if (x < 0 || y < 0 || x > rect.width || y > rect.height) return; // 화면 밖이면 무시
      lure.x = x;
      lure.y = y - (e.pointerType === "touch" ? 60 : 0); // 손가락이면 위로 60px 보정
      lure.until = t + 2; // 앞으로 2초 동안은 먹이보다 커서를 우선함
    };

    const resize = () => {
      ({ w, h } = fitCanvas(canvas, ctx));
      stars = seedStars(w, h, 46);
      if (!hero.x) {
        hero.x = w / 2;
        hero.y = band().lo + 24;
      }
    };

    resize();
    window.addEventListener("resize", resize);

    // ♿ 접근성: 사용자가 OS 설정에서 "움직임 줄이기"를 켜 두었다면
    // 애니메이션 루프를 아예 돌리지 않고, 정지된 낙서 하늘 한 장만 그립니다.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      for (let i = 0; i < 5; i++) {
        const j = makeDebris(pickEdible(), w, 14 + i * 2, 0);
        j.y = h * (0.18 + i * 0.11);
        j.x = j.x0;
        junks.push(j);
      }
      draw();
      return () => window.removeEventListener("resize", resize);
    }

    window.addEventListener("pointermove", onMove);
    raf = requestAnimationFrame(loop);

    // 정리 함수: 페이지를 떠날 때 루프와 리스너를 반드시 해제!
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onMove);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      // aria-hidden: 순수 장식이라 스크린 리더가 읽지 않도록 표시
      aria-hidden="true"
      // pointer-events-none: 클릭이 캔버스를 "통과"해서 뒤의 버튼에 닿게 함
      className="pointer-events-none absolute inset-0 h-full w-full"
    />
  );
}
