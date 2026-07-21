"use client";

// ============================================================================
// 수동 조종 미니게임 — 「우주 냠냠: 조종 에디션」
//
// 누른 지점이 가상 조이스틱의 원점이 된다. 거기서 드래그한 방향으로 추진하고,
// 드래그 거리로 1/2/3단 분사가 갈린다. 우주 관성(마찰 감쇠 + 최소 표류 + 벽 반동)
// 위에서 잔해를 주워 kg을 모으고, 붉은 위험물은 피하고, 연료가 바닥나기 전에
// 연료 셀로 수명을 늘린다. 연료 0 → 표류 유예 동안 셀을 먹으면 재점화.
//
// 아트는 satellite_pet_svg_pack(public/plan/img/pack). kg가 쌓이면 펫이 3단계까지
// 진화하고, 상태(저연료·피격·표류·획득)에 따라 표정이 바뀐다. 보조 드론이 따라오고,
// 획득·피격·자기장·진화 이펙트가 붙는다. 벽에 다가가면 카메라가 살짝 그쪽으로 밀린다.
//
// 원칙(jd-01/jd-03 공통):
// - 초당 60번 바뀌는 상태는 전부 useEffect 클로저 지역 변수. React는 모른다.
// - update(dt)는 상태만 바꾸고 draw()는 읽기만. dt 상한으로 터널링 방지.
// - 획득 판정은 후하게, 피격 판정은 짜게. 자석으로 슬쩍 돕는다.
// ============================================================================

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { BEST_KEY, DOODLE_FONT, SPACE_BG, fitCanvas } from "../lib/doodle-art";
import {
  BG,
  DEBRIS_SPRITES,
  type Emotion,
  FUEL_SRC,
  FX,
  SKIN_KEY,
  SKIN_LABEL,
  type Stage,
  STAGE3_SKINS,
  type Stage3Skin,
  UI,
  debrisSrc,
  drawImg,
  droneSrc,
  img,
  petSrc,
  preload,
} from "../lib/pilot-sprites";
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

/** 난이도 — 연료 경제와 스폰 리듬 (진화가 실제로 보이도록 후하게 튜닝) */
const DIFF = {
  startFuel: 110,
  thrustCosts: [2.5, 7, 16], // 분사 1/2/3단 연료 소모(/s)
  fuelRefill: 30,
  hazardDamage: 14,
  spawnBase: 0.5, // 스폰 간격 기준(초) — ±30% 지터
  driftGrace: 4.5, // 연료 0 이후 표류 유예(초)
};

/** 진화 kg 임계 [2단계, 3단계] — 낮춰서 한 판에 도달 가능하게 */
const EVOLVE_AT = [45, 110];

/** 손맛 튜닝 — 전체화면(CSS px) 기준 */
const TUNE = {
  joyMax: 78,
  joyDead: 8,
  levelAt: [26, 52], // 분사 단계 경계(px)
  thrustAccel: [520, 1150, 2000], // 단계별 가속(px/s²)
  friction: 1.15, // 우주 관성 감쇠
  minSpeed: 55, // 최소 표류 속도
  bounce: 0.72, // 벽 반동
  eatBonus: 10, // 획득 판정 여유(px)
  hitShrink: 0.72, // 피격 판정은 반지름을 이만큼 줄여서
  eatAnim: 0.16, // "꿀꺽" 연출 시간
  magnetPull: 240, // 자석 끌어당김 속도(px/s)
  invincible: 1.3, // 피격 후 무적(초)
  shakeTime: 0.32,
  shakeAmp: 7,
  grace: 2, // 시작 직후 위험물 미출현(초)
  maxDt: 0.05,
  camLead: 0.06, // 카메라가 펫을 따라 밀리는 정도
  camMax: 16, // 카메라 최대 이동(px)
};

const THRUST_COLORS = ["#8ecbff", "#ffd166", "#ff8080"];

// ---- 배경 위성 플라이바이 (충돌 없는 장식) ----------------------------------
// 멀리 지구 뒤에서 작게 나타나 포물선(2차 베지어)을 그리며 천천히 다가와 크게
// 커지다가 화면 옆으로 빠져나간다. 리얼한 인공위성(허블 망원경 등) 실루엣.
const FLYBY_SPRITES = [
  "/plan/img/flyby/hubble.svg",
  "/plan/img/flyby/satellite.svg",
  "/plan/img/flyby/probe.svg",
];

/** 2차 베지어 스칼라 평가 */
const bez = (a: number, b: number, c: number, t: number) => {
  const u = 1 - t;
  return u * u * a + 2 * u * t * b + t * t * c;
};

type Flyby = {
  sprite: string;
  t: number; // 0..1 진행도
  dur: number; // 지속(초)
  x0: number;
  y0: number;
  x1: number;
  y1: number; // 제어점
  x2: number;
  y2: number; // 이탈점
  basePx: number;
  rot0: number;
  spin: number;
};

type Tier = "small" | "medium" | "large";
type Kind = "chip" | "bolt" | "tank" | "hazard" | "fuel";

/** 종류별 스펙 (r=충돌 반지름, kg, 낙하 속도) */
const KIND_STAT: Record<Kind, { drawPx: number; r: number; kg: [number, number]; speed: [number, number]; tier?: Tier }> = {
  chip: { drawPx: 30, r: 12, kg: [2, 4], speed: [60, 105], tier: "small" },
  bolt: { drawPx: 40, r: 16, kg: [5, 9], speed: [55, 90], tier: "medium" },
  tank: { drawPx: 58, r: 24, kg: [15, 25], speed: [40, 62], tier: "large" },
  hazard: { drawPx: 42, r: 18, kg: [0, 0], speed: [85, 150] },
  fuel: { drawPx: 40, r: 16, kg: [0, 0], speed: [55, 80] },
};

const KIND_WEIGHT: { kind: Kind; w: number }[] = [
  { kind: "chip", w: 46 },
  { kind: "bolt", w: 26 },
  { kind: "hazard", w: 18 },
  { kind: "tank", w: 10 },
  { kind: "fuel", w: 13 },
];

function pickKind(allowHazard: boolean): Kind {
  const table = KIND_WEIGHT.filter((k) => allowHazard || k.kind !== "hazard");
  const total = table.reduce((a, k) => a + k.w, 0);
  let r = Math.random() * total;
  for (const k of table) {
    r -= k.w;
    if (r <= 0) return k.kind;
  }
  return "chip";
}

const pick = <T,>(arr: T[]): T => arr[(Math.random() * arr.length) | 0];

type Junk = {
  kind: Kind;
  spr: string;
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

function makeJunk(kind: Kind, w: number, h: number): Junk {
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
  const spr =
    kind === "fuel" ? FUEL_SRC : kind === "hazard" ? FX.alert : debrisSrc(pick(DEBRIS_SPRITES[stat.tier!]));
  return {
    kind,
    spr,
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
type Fx = { src: string; x: number; y: number; age: number; life: number; px: number; grow: number; rise: number; spin: number };
const EAT_WORDS = ["냠!", "꿀꺽!", "좋아!", "수거!"];

/** kg → 진화 단계 */
const stageForKg = (kg: number): Stage => (kg >= EVOLVE_AT[1] ? 3 : kg >= EVOLVE_AT[0] ? 2 : 1);
const STAGE_R: Record<Stage, number> = { 1: 26, 2: 30, 3: 34 };
const STAGE_PX: Record<Stage, number> = { 1: 68, 2: 80, 3: 92 };

export default function JoopsGame() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [ui, setUi] = useState({
    phase: "title" as Phase,
    kg: 0,
    best: 0,
    eaten: 0,
    hits: 0,
    sec: 0,
    stage: 1 as Stage,
  });
  // 3단계 진화 모습(스킨). ref 는 게임 루프가 매 프레임 읽고, state 는 버튼 하이라이트용.
  const [skin, setSkinState] = useState<Stage3Skin>("magnet");
  const skinRef = useRef<Stage3Skin>("magnet");

  useEffect(() => {
    try {
      const s = localStorage.getItem(SKIN_KEY) as Stage3Skin | null;
      if (s && STAGE3_SKINS.includes(s)) {
        skinRef.current = s;
        // localStorage 는 마운트 후에만 읽을 수 있어 하이드레이션 이후 1회 반영한다.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setSkinState(s);
      }
    } catch {}
  }, []);

  const chooseSkin = (s: Stage3Skin) => {
    skinRef.current = s;
    setSkinState(s);
    try {
      localStorage.setItem(SKIN_KEY, s);
    } catch {}
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let w = 0;
    let h = 0;
    let raf = 0;
    let last = performance.now();
    let t = 0;

    let phase: Phase = "title";

    // 자주 쓰는 자산 예열 (늦게 온 그림도 RAF 재그리기에서 자연히 나타난다)
    preload([
      BG,
      petSrc(1, "normal"),
      petSrc(1, "happy"),
      FUEL_SRC,
      FX.alert,
      FX.ring,
      FX.sparkle,
      FX.heart,
      FX.magnet,
      FX.zzz,
      UI.battery,
      UI.coin,
      UI.evo,
      ...DEBRIS_SPRITES.small.map(debrisSrc),
      ...DEBRIS_SPRITES.medium.map(debrisSrc),
      ...DEBRIS_SPRITES.large.map(debrisSrc),
      ...FLYBY_SPRITES,
    ]);
    const bg = img(BG);

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
    let ateFlash = 0; // 방금 먹었을 때 표정용 타이머
    let kgCollected = 0;
    let eaten = 0;
    let hits = 0;
    let best = 0;
    let overAt = 0;
    let thrustLevel = 0;
    let thrusting = false;
    let thrustAng = 0;
    let stage: Stage = 1;
    let petR = STAGE_R[1];
    let shipPx = STAGE_PX[1];
    let magnetRange = 62;
    let camX = 0;
    let camY = 0;
    const drone = { x: 0, y: 0 };
    const junks: Junk[] = [];
    const popups: Popup[] = [];
    const fxs: Fx[] = [];
    const flybys: Flyby[] = []; // 배경 위성 (장식)
    let flybyTimer = 0.8;

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
      setUi({ phase, kg: Math.round(kgCollected), best, eaten, hits, sec: Math.round(elapsed), stage });

    const applyStage = (s: Stage) => {
      stage = s;
      petR = STAGE_R[s];
      shipPx = STAGE_PX[s];
      magnetRange = 62 + (s - 1) * 22; // 진화할수록 자석이 넓어진다
    };

    const spawnFx = (src: string, x: number, y: number, px: number, o: Partial<Fx> = {}) =>
      fxs.push({ src, x, y, age: 0, life: o.life ?? 0.5, px, grow: o.grow ?? 1.4, rise: o.rise ?? 0, spin: o.spin ?? 0 });

    const start = () => {
      phase = "playing";
      pet.x = w / 2;
      pet.y = h * 0.6;
      drone.x = pet.x - 40;
      drone.y = pet.y + 30;
      vx = 0;
      vy = 0;
      fuel = DIFF.startFuel;
      emptyAt = null;
      elapsed = 0;
      spawnTimer = 0.3;
      invincible = 0;
      shake = 0;
      ateFlash = 0;
      kgCollected = 0;
      eaten = 0;
      hits = 0;
      camX = 0;
      camY = 0;
      applyStage(1);
      junks.length = 0;
      popups.length = 0;
      fxs.length = 0;
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
      ateFlash = 0.25;
      popup(
        Math.random() < 0.5 ? `+${Math.round(j.kg)}kg` : pick(EAT_WORDS),
        j.x,
        j.y - 10,
        "#7ee8b2",
      );
      spawnFx(FX.ring, pet.x, pet.y + petR * 0.3, petR * 1.4, { life: 0.42, grow: 2.0 });
      spawnFx(FX.sparkle, j.x, j.y, 26, { life: 0.4, grow: 1.2, spin: 6 });
      playEat();
      // 진화 체크
      const ns = stageForKg(kgCollected);
      if (ns !== stage) evolve(ns);
      pushUi();
    };

    const evolve = (ns: Stage) => {
      applyStage(ns);
      popup("진화!", pet.x, pet.y - petR - 16, "#ffd166");
      spawnFx(UI.evo, pet.x, pet.y - petR - 8, 34, { life: 0.9, grow: 0.6, rise: 40 });
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        spawnFx(FX.sparkle, pet.x + Math.cos(a) * petR, pet.y + Math.sin(a) * petR, 24, {
          life: 0.6,
          grow: 1.6,
          spin: 5,
        });
      }
      shake = Math.max(shake, 0.2);
      playFuelUp();
    };

    const pickupFuel = (j: Junk) => {
      j.eatT = 0;
      const revived = emptyAt !== null;
      fuel = Math.min(DIFF.startFuel, fuel + DIFF.fuelRefill);
      emptyAt = null;
      popup(revived ? "재점화!" : `연료 +${DIFF.fuelRefill}`, j.x, j.y - 10, "#66fcf1");
      spawnFx(FX.heart, pet.x, pet.y - petR * 0.3, 30, { life: 0.6, grow: 1.2, rise: 26 });
      playFuelUp();
    };

    const hit = (j: Junk) => {
      hits += 1;
      invincible = TUNE.invincible;
      shake = TUNE.shakeTime;
      fuel = Math.max(0, fuel - DIFF.hazardDamage);
      popup(`아야! 연료 -${DIFF.hazardDamage}`, pet.x, pet.y - petR - 10, "#ff8080");
      spawnFx(FX.alert, j.x, j.y, 40, { life: 0.45, grow: 0.8 });
      const idx = junks.indexOf(j);
      if (idx >= 0) junks.splice(idx, 1);
      playHit();
      pushUi();
    };

    // 배경 위성 하나 스폰: 하단 중앙(지구 뒤)에서 시작해 위로 호를 그려 옆으로 이탈
    const spawnFlyby = () => {
      const dir = Math.random() < 0.5 ? -1 : 1;
      const jit = (a: number) => (Math.random() * 2 - 1) * a;
      const x0 = w * 0.5 + jit(w * 0.12);
      const y0 = h * 0.92; // 지구 뒤(하단)에서 시작
      const x2 = dir > 0 ? w + 240 : -240; // 크게 커진 위성이 완전히 옆으로 빠지도록 멀리
      const y2 = h * (0.5 + Math.random() * 0.34); // 더 낮게(가까이) 이탈
      const x1 = (x0 + x2) / 2 + jit(w * 0.1);
      const y1 = h * (0.05 + Math.random() * 0.12); // 높이 호를 그림
      flybys.push({
        sprite: FLYBY_SPRITES[(Math.random() * FLYBY_SPRITES.length) | 0],
        t: 0,
        dur: 11 + Math.random() * 6, // 천천히(시네마틱)
        x0,
        y0,
        x1,
        y1,
        x2,
        y2,
        basePx: 66 + Math.random() * 24, // 더 크게
        rot0: jit(0.5),
        spin: jit(0.3), // 느린 궤도 텀블링
      });
    };

    // ---- update: 상태만 바꾼다 ----
    const update = (dt: number) => {
      // 이펙트 수명
      for (let i = fxs.length - 1; i >= 0; i--) {
        fxs[i].age += dt;
        if (fxs[i].age >= fxs[i].life) fxs.splice(i, 1);
      }
      // 보조 드론: 펫 뒤쪽에서 랙 있게 따라온다
      const droneTX = pet.x - 38 - Math.sin(t * 0.8) * 6;
      const droneTY = pet.y + 26 + Math.sin(t * 1.3) * 5;
      drone.x += (droneTX - drone.x) * Math.min(1, dt * 4);
      drone.y += (droneTY - drone.y) * Math.min(1, dt * 4);

      // 배경 위성 플라이바이 (모든 페이즈에서 앰비언트하게)
      flybyTimer -= dt;
      if (flybyTimer <= 0 && flybys.length < 2) {
        spawnFlyby();
        flybyTimer = 5 + Math.random() * 4;
      }
      for (let i = flybys.length - 1; i >= 0; i--) {
        flybys[i].t += dt / flybys[i].dur;
        if (flybys[i].t >= 1) flybys.splice(i, 1);
      }

      if (phase !== "playing") {
        vx -= vx * 1.5 * dt;
        vy -= vy * 1.5 * dt;
        pet.x += (w / 2 - pet.x) * Math.min(1, dt * 1.5);
        pet.y += (h * 0.6 + Math.sin(t * 1.6) * 8 - pet.y) * Math.min(1, dt * 1.5);
        camX += (0 - camX) * Math.min(1, dt * 3);
        camY += (0 - camY) * Math.min(1, dt * 3);
        return;
      }

      elapsed += dt;
      if (invincible > 0) invincible -= dt;
      if (shake > 0) shake -= dt;
      if (ateFlash > 0) ateFlash -= dt;

      if (fuel <= 0 && emptyAt === null) {
        emptyAt = elapsed;
        playFuelEmpty();
      }
      if (emptyAt !== null && elapsed - emptyAt >= DIFF.driftGrace) {
        gameOver();
        return;
      }

      spawnTimer -= dt;
      if (spawnTimer <= 0) {
        junks.push(makeJunk(pickKind(elapsed > TUNE.grace), w, h));
        spawnTimer = DIFF.spawnBase * (0.7 + Math.random() * 0.6);
      }

      // --- 추진 입력: 조이스틱 우선, 없으면 키보드 ---
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

      // --- 우주 관성 ---
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
      if (pet.x < petR) {
        pet.x = petR;
        vx *= -TUNE.bounce;
      } else if (pet.x > w - petR) {
        pet.x = w - petR;
        vx *= -TUNE.bounce;
      }
      if (pet.y < petR) {
        pet.y = petR;
        vy *= -TUNE.bounce;
      } else if (pet.y > h - petR) {
        pet.y = h - petR;
        vy *= -TUNE.bounce;
      }

      // --- 카메라 넛지: 펫이 벽에 다가갈수록 화면이 그쪽으로 살짝 밀린다 ---
      const camTX = Math.max(-TUNE.camMax, Math.min(TUNE.camMax, (pet.x - w / 2) * TUNE.camLead));
      const camTY = Math.max(-TUNE.camMax, Math.min(TUNE.camMax, (pet.y - h / 2) * TUNE.camLead));
      camX += (camTX - camX) * Math.min(1, dt * 4);
      camY += (camTY - camY) * Math.min(1, dt * 4);

      // --- 잔해 ---
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

        if (j.kind !== "hazard") {
          const dx = pet.x - j.x;
          const dy = pet.y - j.y;
          const dist = Math.hypot(dx, dy);
          if (dist > 1 && dist < petR + magnetRange) {
            const pull = (TUNE.magnetPull * dt) / dist;
            j.x += dx * pull;
            j.y += dy * pull;
          }
        }

        const dist = Math.hypot(pet.x - j.x, pet.y - j.y);
        if (j.kind === "hazard") {
          if (invincible <= 0 && dist < petR * TUNE.hitShrink + j.r) {
            hit(j);
            continue;
          }
        } else if (dist < petR + j.r + TUNE.eatBonus) {
          if (j.kind === "fuel") pickupFuel(j);
          else eat(j);
        }

        if (j.x < -60 || j.x > w + 60 || j.y < -60 || j.y > h + 60) junks.splice(i, 1);
      }

      for (let i = popups.length - 1; i >= 0; i--) {
        const p = popups[i];
        p.age += dt;
        p.y -= 22 * dt;
        if (p.age > 0.8) popups.splice(i, 1);
      }
    };

    // 현재 상태에 맞는 펫 표정
    const currentEmotion = (): Emotion => {
      if (phase === "over") return "hibernate";
      if (phase !== "playing") return "happy";
      if (emptyAt !== null) return "hibernate";
      if (invincible > 0) return "sulky";
      if (fuel < DIFF.startFuel * 0.25) return "low_battery";
      if (ateFlash > 0) return "data_full";
      if (thrusting) return "happy";
      return "normal";
    };

    // 배경을 cover로 (카메라·흔들림 여유 포함)
    const drawSpaceBg = () => {
      ctx.fillStyle = SPACE_BG;
      ctx.fillRect(-40, -40, w + 80, h + 80);
      if (bg && bg.complete && bg.naturalWidth > 0) {
        const s = Math.max(w / bg.naturalWidth, h / bg.naturalHeight) * 1.06;
        const dw = bg.naturalWidth * s;
        const dh = bg.naturalHeight * s;
        ctx.drawImage(bg, (w - dw) / 2, (h - dh) / 2, dw, dh);
      }
    };

    // ---- draw: 읽기만 한다 ----
    const draw = () => {
      ctx.save();
      // 카메라 넛지 + 화면 흔들림 (둘 다 월드에만 적용, HUD/조이스틱은 밖에서)
      let ox = -camX;
      let oy = -camY;
      if (shake > 0) {
        const a = (shake / TUNE.shakeTime) * TUNE.shakeAmp;
        ox += (Math.random() - 0.5) * a;
        oy += (Math.random() - 0.5) * a;
      }
      ctx.translate(ox, oy);
      drawSpaceBg();

      // 배경 위성 플라이바이 — 잔해/펫보다 뒤(먼저)에 그린다
      for (const f of flybys) {
        const x = bez(f.x0, f.x1, f.x2, f.t);
        const y = bez(f.y0, f.y1, f.y2, f.t);
        const sc = 0.14 + Math.pow(f.t, 1.3) * 2.0; // 멀리서 작다가 꾸준히 가까이(크게) 다가옴
        const alpha = (f.t < 0.1 ? f.t / 0.1 : 1) * 0.95; // 등장 페이드인
        drawImg(ctx, f.sprite, x, y, f.basePx * sc, f.rot0 + f.spin * f.t * 2, alpha);
      }

      for (const j of junks) {
        const sc = j.eatT >= 0 ? Math.max(0.05, 1 - j.eatT / TUNE.eatAnim) : 1;
        if (!drawImg(ctx, j.spr, j.x, j.y, j.drawPx * sc, j.rot)) {
          ctx.fillStyle = j.kind === "hazard" ? "#ffce59" : "#8ecbff";
          ctx.beginPath();
          ctx.arc(j.x, j.y, (j.drawPx * sc) / 3, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // 자기장 오라 (자석 메커닉 연출, 진화할수록 강하게)
      if (phase === "playing") {
        const pulse = 1 + Math.sin(t * 3) * 0.06;
        drawImg(ctx, FX.magnet, pet.x, pet.y, (petR + magnetRange) * 1.4 * pulse, t * 0.4, 0.12 + stage * 0.04);
      }

      // 추진 화염
      if (thrusting && phase === "playing") {
        ctx.fillStyle = THRUST_COLORS[thrustLevel];
        for (let i = 1; i <= thrustLevel + 2; i++) {
          const flick = Math.random() > 0.4 ? 0 : 3;
          const fx = pet.x - Math.cos(thrustAng) * (petR + flick + i * 6);
          const fy = pet.y - Math.sin(thrustAng) * (petR + flick + i * 6);
          const fs = Math.max(2, 8 - i * 1.6);
          ctx.beginPath();
          ctx.arc(fx, fy, fs, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // 보조 드론 (펫보다 뒤에 작게)
      drawImg(ctx, droneSrc(emptyAt !== null ? "hibernate" : "happy"), drone.x, drone.y, 30, Math.sin(t * 2) * 0.15);

      // 표류 중 Zzz
      if (emptyAt !== null && phase === "playing") {
        drawImg(ctx, FX.zzz, pet.x + petR * 0.7, pet.y - petR - 6 - Math.sin(t * 2) * 3, 26, 0, 0.9);
      }

      // 펫 (무적 중 깜빡)
      const blink = invincible > 0 && Math.floor(t * 16) % 2 === 1 && phase === "playing";
      if (!blink) {
        const bob = Math.sin(t * 3) * 2;
        if (!drawImg(ctx, petSrc(stage, currentEmotion(), skinRef.current), pet.x, pet.y + bob, shipPx)) {
          ctx.fillStyle = "#7ee8b2";
          ctx.beginPath();
          ctx.arc(pet.x, pet.y, petR, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // 이펙트 (펫 위)
      for (const f of fxs) {
        const k = f.age / f.life;
        drawImg(ctx, f.src, f.x, f.y - f.rise * k, f.px * (1 + f.grow * k), f.spin * f.age, Math.max(0, 1 - k));
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

      // 조이스틱 (화면 고정)
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
      // 연료 게이지 + 배터리 아이콘
      drawImg(ctx, UI.battery, pad + 9, top + 6, 24);
      const barX = pad + 24;
      const barW = Math.min(180, w * 0.4);
      const barH = 12;
      ctx.fillStyle = "#2a3358";
      ctx.fillRect(barX, top, barW, barH);
      const frac = Math.max(0, fuel / DIFF.startFuel);
      ctx.fillStyle = frac > 0.25 ? "#66fcf1" : "#ff8080";
      ctx.fillRect(barX, top, barW * frac, barH);

      // kg + 스크랩 아이콘 + 시간 (우측)
      drawImg(ctx, UI.coin, w - pad - 8, top + 4, 22);
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      ctx.font = `700 22px ${DOODLE_FONT}`;
      ctx.fillStyle = "#7ee8b2";
      ctx.fillText(`${Math.round(kgCollected)}kg`, w - pad - 24, top + 6);
      ctx.font = `700 14px ${DOODLE_FONT}`;
      ctx.fillStyle = "#8ecbff";
      ctx.fillText(`T+${String(Math.floor(elapsed)).padStart(2, "0")}s · ${stage}단계`, w - pad, top + 28);
      if (hits > 0) {
        ctx.fillStyle = "#ff8080";
        ctx.fillText(`피격 ×${hits}`, w - pad, top + 46);
      }

      if (emptyAt !== null && Math.floor(t * 4) % 2 === 0) {
        const remain = Math.max(0, Math.ceil(DIFF.driftGrace - (elapsed - emptyAt)));
        ctx.textAlign = "center";
        ctx.font = `700 22px ${DOODLE_FONT}`;
        ctx.fillStyle = "#ff8080";
        ctx.fillText(`⚠ 연료 소진 — 표류 ${remain}s`, w / 2, top + 34);
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
        if (t - overAt < 0.6) return;
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
      if (!pet.x) {
        pet.x = w / 2;
        pet.y = h * 0.6;
        drone.x = pet.x - 40;
        drone.y = pet.y + 30;
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
            잔해를 주워 <span className="text-[#7ee8b2]">kg</span>을 모으면 <span className="text-[#ffd166]">진화</span>하고,
            <br />
            <span className="text-[#66fcf1]">연료 셀</span>로 재점화해요. <span className="text-[#ffce59]">⚠ 경고물</span>은 연료를 깎아요!
          </p>
          {/* 3단계 진화 모습(스킨) 선택 */}
          <div className="pointer-events-auto mt-1 flex flex-col items-center gap-1">
            <p className="text-sm text-zinc-400">3단계 진화 모습</p>
            <div className="flex items-center gap-2">
              {STAGE3_SKINS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => chooseSkin(s)}
                  aria-pressed={skin === s}
                  className={`flex flex-col items-center gap-0.5 rounded-xl border-2 px-2 py-1 transition ${
                    skin === s ? "border-[#7ee8b2] bg-[#7ee8b2]/15" : "border-white/15"
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={petSrc(3, "happy", s)} alt="" aria-hidden className="h-9 w-9" />
                  <span className={`text-sm font-bold ${skin === s ? "text-[#7ee8b2]" : "text-zinc-300"}`}>
                    {SKIN_LABEL[s]}
                  </span>
                </button>
              ))}
            </div>
          </div>
          {ui.best > 0 && <p className="rotate-1 text-lg text-[#ffd166]">최고 기록 {ui.best}kg</p>}
          <p className="mt-1 animate-bounce text-2xl font-bold text-[#ffd166]">👆 탭해서 출격!</p>
          <Link
            href="/"
            className="pointer-events-auto mt-4 text-base text-zinc-400 underline underline-offset-4"
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
            잔해 <span className="font-bold text-[#7ee8b2]">{ui.eaten}개</span> 수거 · {ui.stage}단계 · {ui.sec}초 비행
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
