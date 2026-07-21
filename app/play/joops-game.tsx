"use client";

// ============================================================================
// 수동 조종 미니게임 — 「우주 냠냠: 조종 에디션」
//
// 누른 지점이 가상 조이스틱의 원점이 된다. 거기서 드래그한 방향으로 추진하고,
// 드래그 거리로 1/2/3단 분사가 갈린다. 우주 관성(마찰 감쇠 + 최소 표류 + 벽 반동)
// 위에서 잔해를 주워 kg을 모으고, 붉은 위험물은 피하고, 연료가 바닥나기 전에
// 연료 셀로 수명을 늘린다. 연료 0 → 표류 유예 동안 셀을 먹으면 재점화.
//
// 조작/물리는 형제 레포 jd-03의 SortieGame에서 이식했고, 배경·폰트·화면 구성은
// jd-01의 두들 정체성을 그대로 유지한다. 엔티티는 public/plan/img 의 SVG로 그린다.
//
// 원칙(jd-01/jd-03 공통):
// - 초당 60번 바뀌는 상태는 전부 useEffect 클로저 지역 변수. React는 모른다.
// - update(dt)는 상태만 바꾸고 draw()는 읽기만. dt 상한으로 터널링 방지.
// - 획득 판정은 후하게, 피격 판정은 짜게. 자석으로 슬쩍 돕는다.
// ============================================================================

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { createDoodle } from "../lib/doodle";
import {
  BEST_KEY,
  DOODLE_FONT,
  type BgStar,
  drawBackdrop,
  fitCanvas,
  seedStars,
} from "../lib/doodle-art";
import { type PilotKind, drawSprite, loadSprites } from "../lib/pilot-sprites";
import {
  closeAudio,
  ensureAudio,
  playEat,
  playEnd,
  playFuelEmpty,
  playFuelUp,
  playHit,
  playStart,
  updateThrustSound,
} from "../lib/pilot-sound";

type Phase = "title" | "playing" | "over";

/** 난이도 — 연료 경제와 스폰 리듬 */
const DIFF = {
  startFuel: 100,
  thrustCosts: [3, 8, 18], // 분사 1/2/3단 연료 소모(/s)
  fuelRefill: 26,
  hazardDamage: 16,
  spawnBase: 0.55, // 스폰 간격 기준(초) — ±30% 지터
  driftGrace: 4, // 연료 0 이후 표류 유예(초)
};

/** 손맛 튜닝 — 전체화면(CSS px) 기준으로 jd-03 값을 키웠다 */
const TUNE = {
  joyMax: 78,
  joyDead: 8,
  levelAt: [26, 52], // 분사 단계 경계(px)
  thrustAccel: [520, 1150, 2000], // 단계별 가속(px/s²)
  friction: 1.15, // 우주 관성 감쇠
  minSpeed: 55, // 한 번 움직이면 유지되는 최소 표류 속도
  bounce: 0.72, // 벽 반동
  eatBonus: 10, // 획득 판정 여유(px)
  hitShrink: 0.72, // 피격 판정은 반지름을 이만큼 줄여서
  eatAnim: 0.16, // "꿀꺽" 연출 시간
  magnetRange: 62, // petR에 더해지는 자석 범위(px)
  magnetPull: 240, // 자석 끌어당김 속도(px/s)
  invincible: 1.3, // 피격 후 무적(초)
  blinkHz: 8,
  shakeTime: 0.32,
  shakeAmp: 7,
  grace: 2, // 시작 직후 위험물 미출현(초)
  maxDt: 0.05,
  shipPx: 62, // 우주선 그림 한 변(px)
  petR: 26, // 우주선 충돌 반지름
};

const THRUST_COLORS = ["#8ecbff", "#ffd166", "#ff8080"];

/** 잔해 종류별 스펙 (drawPx=그림 크기, r=충돌 반지름) */
const KIND_STAT: Record<
  PilotKind,
  { drawPx: number; r: number; kg: [number, number]; speed: [number, number] }
> = {
  ship: { drawPx: TUNE.shipPx, r: TUNE.petR, kg: [0, 0], speed: [0, 0] },
  chip: { drawPx: 26, r: 12, kg: [2, 4], speed: [60, 105] },
  bolt: { drawPx: 34, r: 16, kg: [5, 9], speed: [55, 90] },
  tank: { drawPx: 52, r: 24, kg: [15, 25], speed: [40, 62] },
  hazard: { drawPx: 40, r: 18, kg: [0, 0], speed: [85, 150] },
  fuel: { drawPx: 36, r: 16, kg: [0, 0], speed: [55, 80] },
};

/** 등장 가중치 (상대비) — 위험물은 grace 이후에만 */
const KIND_WEIGHT: { kind: PilotKind; w: number }[] = [
  { kind: "chip", w: 46 },
  { kind: "bolt", w: 26 },
  { kind: "hazard", w: 18 },
  { kind: "tank", w: 10 },
  { kind: "fuel", w: 13 },
];

function pickKind(allowHazard: boolean): PilotKind {
  const table = KIND_WEIGHT.filter((k) => allowHazard || k.kind !== "hazard");
  const total = table.reduce((a, k) => a + k.w, 0);
  let r = Math.random() * total;
  for (const k of table) {
    r -= k.w;
    if (r <= 0) return k.kind;
  }
  return "chip";
}

type Junk = {
  kind: PilotKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  drawPx: number;
  kg: number;
  rot: number;
  vrot: number;
  eatT: number; // -1 = 떠다니는 중, 0..eatAnim = 빨려드는 중
};

/** 네 가장자리 중 하나에서 화면 안쪽(±0.7rad)을 향해 진입 */
function makeJunk(kind: PilotKind, w: number, h: number): Junk {
  const stat = KIND_STAT[kind];
  const speed = stat.speed[0] + Math.random() * (stat.speed[1] - stat.speed[0]);
  const edge = Math.floor(Math.random() * 4);
  let x: number;
  let y: number;
  let base: number;
  if (edge === 0) {
    x = Math.random() * w;
    y = -30;
    base = Math.PI / 2;
  } else if (edge === 1) {
    x = w + 30;
    y = Math.random() * h;
    base = Math.PI;
  } else if (edge === 2) {
    x = Math.random() * w;
    y = h + 30;
    base = -Math.PI / 2;
  } else {
    x = -30;
    y = Math.random() * h;
    base = 0;
  }
  const ang = base + (Math.random() * 2 - 1) * 0.7;
  return {
    kind,
    x,
    y,
    vx: Math.cos(ang) * speed,
    vy: Math.sin(ang) * speed,
    r: stat.r,
    drawPx: stat.drawPx,
    kg: stat.kg[0] + Math.random() * (stat.kg[1] - stat.kg[0]),
    rot: Math.random() * Math.PI * 2,
    vrot: (Math.random() * 2 - 1) * 1.6,
    eatT: -1,
  };
}

type Popup = { text: string; x: number; y: number; age: number; color: string };
const EAT_WORDS = ["냠!", "꿀꺽!", "좋아!", "수거!"];

export default function JoopsGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ui, setUi] = useState({
    phase: "title" as Phase,
    kg: 0,
    best: 0,
    eaten: 0,
    hits: 0,
    sec: 0,
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const d = createDoodle(ctx);
    const bank = loadSprites();

    let w = 0;
    let h = 0;
    let raf = 0;
    let last = performance.now();
    let t = 0;

    let phase: Phase = "title";
    let stars: BgStar[] = [];

    // ---- 시뮬레이션 상태 (전부 클로저 지역 변수) ----
    const pet = { x: 0, y: 0 };
    let vx = 0;
    let vy = 0;
    let fuel = DIFF.startFuel;
    let emptyAt: number | null = null; // 연료 소진 시각(elapsed). null=정상
    let elapsed = 0;
    let spawnTimer = 0.3;
    let invincible = 0;
    let shake = 0;
    let kgCollected = 0;
    let eaten = 0;
    let hits = 0;
    let best = 0;
    let overAt = 0;
    let thrustLevel = 0;
    let thrusting = false;
    let thrustAng = 0;
    const junks: Junk[] = [];
    const popups: Popup[] = [];

    try {
      best = Number(localStorage.getItem(BEST_KEY)) || 0;
    } catch {}

    // 입력: 가상 조이스틱 + 키보드
    let joyActive = false;
    let joyOx = 0;
    let joyOy = 0;
    let joyCx = 0;
    let joyCy = 0;
    const keys = new Set<string>();

    const pushUi = () =>
      setUi({ phase, kg: Math.round(kgCollected), best, eaten, hits, sec: Math.round(elapsed) });

    const start = () => {
      phase = "playing";
      pet.x = w / 2;
      pet.y = h * 0.6;
      vx = 0;
      vy = 0;
      fuel = DIFF.startFuel;
      emptyAt = null;
      elapsed = 0;
      spawnTimer = 0.3;
      invincible = 0;
      shake = 0;
      kgCollected = 0;
      eaten = 0;
      hits = 0;
      junks.length = 0;
      popups.length = 0;
      playStart();
      pushUi();
    };

    const gameOver = () => {
      if (phase !== "playing") return;
      phase = "over";
      overAt = t;
      updateThrustSound(0);
      if (Math.round(kgCollected) > best) {
        best = Math.round(kgCollected);
        try {
          localStorage.setItem(BEST_KEY, String(best));
        } catch {}
      }
      playEnd();
      pushUi();
    };

    const popup = (text: string, x: number, y: number, color: string) =>
      popups.push({ text, x, y, age: 0, color });

    const eat = (j: Junk) => {
      j.eatT = 0;
      kgCollected += j.kg;
      eaten += 1;
      popup(
        Math.random() < 0.5 ? `+${Math.round(j.kg)}kg` : EAT_WORDS[(Math.random() * EAT_WORDS.length) | 0],
        j.x,
        j.y - 10,
        "#7ee8b2",
      );
      playEat();
      pushUi();
    };

    const pickupFuel = (j: Junk) => {
      j.eatT = 0;
      const revived = emptyAt !== null;
      fuel = Math.min(DIFF.startFuel, fuel + DIFF.fuelRefill);
      emptyAt = null;
      popup(revived ? "재점화!" : `연료 +${DIFF.fuelRefill}`, j.x, j.y - 10, "#66fcf1");
      playFuelUp();
    };

    const hit = (j: Junk) => {
      hits += 1;
      invincible = TUNE.invincible;
      shake = TUNE.shakeTime;
      fuel = Math.max(0, fuel - DIFF.hazardDamage);
      popup(`아야! 연료 -${DIFF.hazardDamage}`, pet.x, pet.y - TUNE.petR - 10, "#ff8080");
      const idx = junks.indexOf(j);
      if (idx >= 0) junks.splice(idx, 1);
      playHit();
      pushUi();
    };

    // ---- update: 상태만 바꾼다 ----
    const update = (dt: number) => {
      if (phase !== "playing") {
        // 타이틀/오버: 우주선은 화면 중앙에서 살짝 표류
        vx -= vx * 1.5 * dt;
        vy -= vy * 1.5 * dt;
        pet.x += (w / 2 - pet.x) * Math.min(1, dt * 1.5);
        pet.y += (h * 0.6 + Math.sin(t * 1.6) * 8 - pet.y) * Math.min(1, dt * 1.5);
        return;
      }

      elapsed += dt;
      if (invincible > 0) invincible -= dt;
      if (shake > 0) shake -= dt;

      // 연료 소진 → 표류 유예 → 종료 (유예 중 셀을 먹으면 부활)
      if (fuel <= 0 && emptyAt === null) {
        emptyAt = elapsed;
        playFuelEmpty();
      }
      if (emptyAt !== null && elapsed - emptyAt >= DIFF.driftGrace) {
        gameOver();
        return;
      }

      // 스폰
      spawnTimer -= dt;
      if (spawnTimer <= 0) {
        junks.push(makeJunk(pickKind(elapsed > TUNE.grace), w, h));
        spawnTimer = DIFF.spawnBase * (0.7 + Math.random() * 0.6);
      }

      // --- 추진 입력 정리: 조이스틱 우선, 없으면 키보드 ---
      let tdx = 0;
      let tdy = 0;
      let level = 0;
      let active = false;
      if (joyActive) {
        const dx = joyCx - joyOx;
        const dy = joyCy - joyOy;
        const dist = Math.hypot(dx, dy);
        if (dist > TUNE.joyDead) {
          active = true;
          tdx = dx / dist;
          tdy = dy / dist;
          level = dist < TUNE.levelAt[0] ? 0 : dist < TUNE.levelAt[1] ? 1 : 2;
        }
      } else {
        let kx = 0;
        let ky = 0;
        if (keys.has("ArrowLeft") || keys.has("a")) kx -= 1;
        if (keys.has("ArrowRight") || keys.has("d")) kx += 1;
        if (keys.has("ArrowUp") || keys.has("w")) ky -= 1;
        if (keys.has("ArrowDown") || keys.has("s")) ky += 1;
        if (kx || ky) {
          const m = Math.hypot(kx, ky);
          active = true;
          tdx = kx / m;
          tdy = ky / m;
          level = 1;
        }
      }

      thrusting = false;
      if (active && fuel > 0) {
        const cost = DIFF.thrustCosts[level] * dt;
        if (fuel >= cost) {
          fuel -= cost;
          const acc = TUNE.thrustAccel[level];
          vx += tdx * acc * dt;
          vy += tdy * acc * dt;
          thrusting = true;
          thrustLevel = level;
          thrustAng = Math.atan2(tdy, tdx);
        } else {
          fuel = 0;
        }
      }
      updateThrustSound(thrusting ? thrustLevel + 1 : 0);

      // --- 우주 관성: 마찰 감쇠 + 최소 표류 유지 ---
      vx -= vx * TUNE.friction * dt;
      vy -= vy * TUNE.friction * dt;
      const sp = Math.hypot(vx, vy);
      if (sp > 0 && sp < TUNE.minSpeed) {
        vx = (vx / sp) * TUNE.minSpeed;
        vy = (vy / sp) * TUNE.minSpeed;
      }
      pet.x += vx * dt;
      pet.y += vy * dt;

      // --- 벽 반동 ---
      const R = TUNE.petR;
      if (pet.x < R) {
        pet.x = R;
        vx *= -TUNE.bounce;
      } else if (pet.x > w - R) {
        pet.x = w - R;
        vx *= -TUNE.bounce;
      }
      if (pet.y < R) {
        pet.y = R;
        vy *= -TUNE.bounce;
      } else if (pet.y > h - R) {
        pet.y = h - R;
        vy *= -TUNE.bounce;
      }

      // --- 잔해: 역순 순회 + splice ---
      for (let i = junks.length - 1; i >= 0; i--) {
        const j = junks[i];

        if (j.eatT >= 0) {
          j.eatT += dt;
          const suck = Math.min(1, dt * 18);
          j.x += (pet.x - j.x) * suck;
          j.y += (pet.y - j.y) * suck;
          j.rot += 25 * dt;
          if (j.eatT >= TUNE.eatAnim) junks.splice(i, 1);
          continue;
        }

        j.x += j.vx * dt;
        j.y += j.vy * dt;
        j.rot += j.vrot * dt;

        // 자석: 위험물 빼고 슬쩍 끌려온다
        if (j.kind !== "hazard") {
          const dx = pet.x - j.x;
          const dy = pet.y - j.y;
          const dist = Math.hypot(dx, dy);
          if (dist > 1 && dist < R + TUNE.magnetRange) {
            const pull = (TUNE.magnetPull * dt) / dist;
            j.x += dx * pull;
            j.y += dy * pull;
          }
        }

        const dist = Math.hypot(pet.x - j.x, pet.y - j.y);
        if (j.kind === "hazard") {
          if (invincible <= 0 && dist < R * TUNE.hitShrink + j.r) {
            hit(j);
            continue;
          }
        } else if (dist < R + j.r + TUNE.eatBonus) {
          if (j.kind === "fuel") pickupFuel(j);
          else eat(j);
        }

        // 화면 밖으로 충분히 나가면 제거
        if (j.x < -60 || j.x > w + 60 || j.y < -60 || j.y > h + 60) junks.splice(i, 1);
      }

      for (let i = popups.length - 1; i >= 0; i--) {
        const p = popups[i];
        p.age += dt;
        p.y -= 22 * dt;
        if (p.age > 0.8) popups.splice(i, 1);
      }
    };

    // ---- draw: 읽기만 한다 ----
    const draw = () => {
      d.setPhase(Math.floor(t * 7)); // 손그림 "끓는 선"
      ctx.save();
      if (shake > 0) {
        const a = (shake / TUNE.shakeTime) * TUNE.shakeAmp;
        ctx.translate((Math.random() - 0.5) * a, (Math.random() - 0.5) * a);
      }
      drawBackdrop(ctx, d, w, h, t, stars);

      // 잔해
      for (const j of junks) {
        const sc = j.eatT >= 0 ? Math.max(0.05, 1 - j.eatT / TUNE.eatAnim) : 1;
        drawSprite(ctx, bank, j.kind, j.x, j.y, j.drawPx * sc, j.rot);
      }

      // 추진 화염 (우주선 뒤쪽)
      if (thrusting && phase === "playing") {
        ctx.fillStyle = THRUST_COLORS[thrustLevel];
        for (let i = 1; i <= thrustLevel + 2; i++) {
          const flick = Math.random() > 0.4 ? 0 : 3;
          const fx = pet.x - Math.cos(thrustAng) * (TUNE.petR + flick + i * 6);
          const fy = pet.y - Math.sin(thrustAng) * (TUNE.petR + flick + i * 6);
          const fs = Math.max(2, 8 - i * 1.6);
          ctx.beginPath();
          ctx.arc(fx, fy, fs, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // 우주선 (무적 중 깜빡)
      const blink =
        invincible > 0 && Math.floor(t * TUNE.blinkHz * 2) % 2 === 1 && phase === "playing";
      if (!blink) {
        const bob = Math.sin(t * 3) * 2;
        drawSprite(ctx, bank, "ship", pet.x, pet.y + bob, TUNE.shipPx);
      }

      // 팝업
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      for (const p of popups) {
        ctx.globalAlpha = Math.max(0, 1 - p.age / 0.8);
        ctx.font = `700 20px ${DOODLE_FONT}`;
        ctx.lineWidth = 4;
        ctx.strokeStyle = "#141838";
        ctx.strokeText(p.text, p.x, p.y);
        ctx.fillStyle = p.color;
        ctx.fillText(p.text, p.x, p.y);
      }
      ctx.globalAlpha = 1;
      ctx.restore();

      // 조이스틱 (흔들림 밖)
      if (joyActive && phase === "playing") {
        ctx.globalAlpha = 0.16;
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(joyOx, joyOy, TUNE.joyMax, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 0.85;
        ctx.fillStyle = fuel > 0 ? THRUST_COLORS[thrustLevel] : "#5a6284";
        ctx.beginPath();
        ctx.arc(joyCx, joyCy, 14, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }

      if (phase === "playing") drawHud();
    };

    const drawHud = () => {
      const pad = 16;
      const top = 14;
      // 연료 게이지
      const barW = Math.min(200, w * 0.42);
      const barH = 12;
      ctx.fillStyle = "rgba(5,6,15,0.45)";
      ctx.fillRect(pad - 4, top - 4, barW + 8, barH + 8);
      ctx.fillStyle = "#2a3358";
      ctx.fillRect(pad, top, barW, barH);
      const frac = Math.max(0, fuel / DIFF.startFuel);
      ctx.fillStyle = frac > 0.25 ? "#66fcf1" : "#ff8080";
      ctx.fillRect(pad, top, barW * frac, barH);
      ctx.font = `700 15px ${DOODLE_FONT}`;
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#e8ecf7";
      ctx.fillText("연료", pad, top + barH + 14);

      // kg · 시간 (우측)
      ctx.textAlign = "right";
      ctx.font = `700 22px ${DOODLE_FONT}`;
      ctx.fillStyle = "#7ee8b2";
      ctx.fillText(`${Math.round(kgCollected)}kg`, w - pad, top + 6);
      ctx.font = `700 14px ${DOODLE_FONT}`;
      ctx.fillStyle = "#8ecbff";
      ctx.fillText(`T+${String(Math.floor(elapsed)).padStart(2, "0")}s`, w - pad, top + 26);
      if (hits > 0) {
        ctx.fillStyle = "#ff8080";
        ctx.fillText(`피격 ×${hits}`, w - pad, top + 44);
      }

      // 표류 경고 (깜빡)
      if (emptyAt !== null && Math.floor(t * 4) % 2 === 0) {
        const remain = Math.max(0, Math.ceil(DIFF.driftGrace - (elapsed - emptyAt)));
        ctx.textAlign = "center";
        ctx.font = `700 22px ${DOODLE_FONT}`;
        ctx.fillStyle = "#ff8080";
        ctx.fillText(`⚠ 연료 소진 — 표류 ${remain}s`, w / 2, top + 30);
      }
    };

    const loop = (now: number) => {
      const dt = Math.min(TUNE.maxDt, (now - last) / 1000);
      last = now;
      t += dt;
      update(dt);
      draw();
      raf = requestAnimationFrame(loop);
    };

    // ---- 입력 ----
    const toLocal = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };
    const onDown = (e: PointerEvent) => {
      e.preventDefault();
      ensureAudio();
      if (phase === "title") {
        start();
        return;
      }
      if (phase === "over") {
        if (t - overAt < 0.6) return; // 죽은 순간의 손가락 무시
        start();
        return;
      }
      const p = toLocal(e);
      joyOx = p.x;
      joyOy = p.y;
      joyCx = p.x;
      joyCy = p.y;
      joyActive = true;
      canvas.setPointerCapture(e.pointerId);
    };
    const onMove = (e: PointerEvent) => {
      if (!joyActive) return;
      const p = toLocal(e);
      const dx = p.x - joyOx;
      const dy = p.y - joyOy;
      const dist = Math.hypot(dx, dy);
      if (dist > TUNE.joyMax) {
        joyCx = joyOx + (dx / dist) * TUNE.joyMax;
        joyCy = joyOy + (dy / dist) * TUNE.joyMax;
      } else {
        joyCx = p.x;
        joyCy = p.y;
      }
    };
    const onUp = () => {
      joyActive = false;
    };
    const onKeyDown = (e: KeyboardEvent) => {
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      if (k === " " || k === "Enter") {
        ensureAudio();
        if (phase === "title") start();
        else if (phase === "over" && t - overAt >= 0.6) start();
        e.preventDefault();
        return;
      }
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "w", "a", "s", "d"].includes(k)) {
        keys.add(k);
        e.preventDefault();
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      keys.delete(k);
    };

    const resize = () => {
      ({ w, h } = fitCanvas(canvas, ctx));
      stars = seedStars(w, h, 46);
      if (!pet.x) {
        pet.x = w / 2;
        pet.y = h * 0.6;
      }
    };

    resize();
    pushUi();
    window.addEventListener("resize", resize);
    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointercancel", onUp);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointercancel", onUp);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      closeAudio();
    };
  }, []);

  return (
    <div
      className="fixed inset-0 select-none overflow-hidden bg-[#141838] text-zinc-100"
      style={{ WebkitTouchCallout: "none" }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* touch-none: 없으면 브라우저가 드래그를 스크롤로 가로채 pointermove가 끊긴다 */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full touch-none"
        role="application"
        aria-label="우주선 수동 조종 미니게임. 화면을 눌러 끌면 그 방향으로 추진합니다."
      />

      {ui.phase === "title" && (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-3 px-8 pb-[26vh] text-center">
          <p className="-rotate-3 text-xl text-[#8ecbff]">SPACE JOOPS · 조종 에디션</p>
          <h1
            className="-rotate-2 text-6xl font-bold leading-none text-[#7ee8b2]"
            style={{ textShadow: "0 4px 0 rgba(0,0,0,.45)" }}
          >
            궤도 조종!
          </h1>
          <p className="mt-2 text-xl leading-8 text-zinc-200">
            화면을 <span className="text-[#ffd166]">눌러서 슥</span> 끌면
            <br />그 방향으로 <span className="text-[#8ecbff]">분사</span>해요. 멀리 끌수록 강하게!
            <br />
            잔해를 주워 <span className="text-[#7ee8b2]">kg</span>을 모으고, 연료가 바닥나기 전에
            <br />
            <span className="text-[#66fcf1]">연료 셀</span>을 먹어요. <span className="text-[#ff8080]">붉은 가시</span>는 연료를 깎아요!
          </p>
          {ui.best > 0 && <p className="rotate-1 text-lg text-[#ffd166]">최고 기록 {ui.best}kg</p>}
          <p className="mt-3 animate-bounce text-2xl font-bold text-[#ffd166]">👆 탭해서 출격!</p>
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
            연료 소진…
          </h2>
          <p className="mt-1 text-xl text-zinc-200">
            잔해 <span className="font-bold text-[#7ee8b2]">{ui.eaten}개</span> 수거 · {ui.sec}초 비행
          </p>
          <p className="mt-3 rotate-1 text-4xl font-bold text-[#ffd166]">{ui.kg}kg</p>
          <p className="text-lg text-zinc-300">
            최고 기록 {ui.best}kg
            {ui.kg >= ui.best && ui.kg > 0 ? " · 신기록! 🎉" : ""}
          </p>
          <p className="mt-4 animate-bounce text-2xl font-bold text-[#7ee8b2]">👆 탭해서 다시 출격!</p>
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
