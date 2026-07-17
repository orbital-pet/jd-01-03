"use client";
// ↑ "use client": 이 컴포넌트는 서버가 아니라 "브라우저에서" 실행하라는 표시.
//   캔버스, 이벤트, requestAnimationFrame 같은 브라우저 기능을 쓰려면 필수입니다.

/**
 * 🎮 joops-game.tsx — 게임 본체
 *
 * 이 파일은 서로 다른 두 세계가 협력하는 구조입니다:
 *
 *   ┌─ React 세계 ──────────────────────────────────────┐
 *   │  useState의 ui 하나만 관리.                          │
 *   │  점수판·타이틀·게임오버 화면을 "가끔"만 다시 그림.       │
 *   └───────────────▲───────────────────────────────────┘
 *                   │ pushUi() ← 점수/하트가 바뀌는 순간에만!
 *   ┌───────────────┴───────────────────────────────────┐
 *   │  게임 세계 (useEffect 안의 클로저)                    │
 *   │  초당 60번 도는 게임 루프. 상태는 전부 평범한 지역 변수. │
 *   │  React를 전혀 모르고, 캔버스에 직접 그림.              │
 *   └───────────────────────────────────────────────────┘
 *
 * 왜 게임 상태를 useState에 넣지 않을까?
 *   매 프레임 setState를 부르면 초당 60번 React가 다시 렌더링됩니다.
 *   폰에서는 그걸 감당 못 해요. 그래서 원칙은:
 *   ★ "초당 60번 변하는 것은 캔버스에 그리고, 가끔 변하는 것만 React에 알린다" ★
 */

import { useEffect, useRef, useState } from "react";
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
import { loadBest, saveBest } from "../lib/storage";
import { buzz, createSound } from "../lib/sound";
import { GameOverScreen, Hud, type Phase, TitleScreen } from "./game-ui";

/**
 * 🎛️ 게임 튜닝판 — 여기 숫자들을 바꿔가며 놀아보세요!
 * 저장하면 화면이 바로 새로고침되니(핫 리로드) 실험하기 딱 좋아요.
 */
const TUNE = {
  startLives: 3, // 시작 하트 개수
  junkScore: 10, // 일반 쓰레기 점수
  starScore: 40, // 별 보너스 점수
  playerStartR: 24, // 주인공의 처음 크기 (반지름, px)
  playerMaxR: 38, // 최대로 커질 수 있는 크기
  growPerEat: 0.45, // 하나 먹을 때마다 커지는 정도
  followSpeed: 7, // 손가락을 따라가는 속도 (크게 = 즉시, 작게 = 굼벵이)
  magnetRange: 70, // 이 거리(px) 안의 먹이를 자석처럼 끌어당김
  invulTime: 1.4, // 맞은 뒤 무적 시간(초) — 없으면 하트가 한꺼번에 증발해요
};

export default function JoopsGame() {
  // useRef: 렌더링 사이에도 살아남는 "이름표". 캔버스 DOM 요소를 붙잡아 둡니다.
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // React가 아는 유일한 상태. 점수판/타이틀/게임오버 화면을 그릴 때만 씁니다.
  const [ui, setUi] = useState({ phase: "title" as Phase, score: 0, lives: 3, best: 0, eaten: 0 });

  // useEffect(..., []): 컴포넌트가 화면에 "처음 등장한 직후" 딱 한 번 실행.
  // 이 함수 안의 지역 변수들은 클로저에 갇혀 게임이 끝날 때까지 살아 있습니다.
  useEffect(() => {
    // ─────────────────────────── ① 준비물 꺼내기 ───────────────────────────
    const canvas = canvasRef.current;
    if (!canvas) return; // 혹시 캔버스가 없으면 조용히 포기 (방어 코드)
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const d = createDoodle(ctx); // 손그림 도구 상자
    const sound = createSound(); // 효과음 신시사이저

    // ─────────────── ② 게임 상태 — 전부 "평범한 지역 변수"! ───────────────
    let w = 0; // 화면 폭 (CSS 픽셀)
    let h = 0; // 화면 높이
    let raf = 0; // requestAnimationFrame 예약 번호 (나중에 취소할 때 필요)
    let last = performance.now(); // 직전 프레임의 시각 (dt 계산용)
    let t = 0; // 게임 시작 후 흐른 시간(초) — 모든 애니메이션의 재료

    let phase: Phase = "title"; // 지금 어느 화면인지 (상태 기계)
    let score = 0;
    let lives = TUNE.startLives;
    let eaten = 0; // 이번 판에 먹은 개수
    let best = loadBest(); // 저장된 최고 기록 불러오기
    let overAt = 0; // 게임오버가 된 시각 (재시작 오작동 방지용)
    let shake = 0; // 화면 흔들림 남은 시간
    let spawnIn = 0.4; // 다음 쓰레기가 나올 때까지 남은 시간 (카운트다운)

    // 주인공의 모든 상태를 담은 객체
    const player = {
      x: 0, // 현재 위치
      y: 0,
      tx: 0, // 목표 위치 (손가락이 가리키는 곳) — x가 tx를 "따라감"
      ty: 0,
      r: TUNE.playerStartR, // 몸 크기 (먹을수록 커짐)
      mouth: 0, // 입 벌림 정도 0~1
      blink: 2.5, // 다음 눈 깜빡임까지 남은 시간
      blinkT: 0, // 0보다 크면 지금 눈 감는 중
      invul: 0, // 남은 무적 시간
      look: { x: 0, y: 1 }, // 시선 방향 (제일 가까운 먹이 쪽)
    };

    // 화면 위의 모든 것들 — 클래스도 상속도 없이, 그냥 "객체가 든 배열" 4개.
    // 소규모 게임에서는 이게 가장 빠르고 가장 읽기 쉽습니다.
    let junks: Debris[] = []; // 떨어지는 쓰레기들
    let popups: Popup[] = []; // "냠!" 같은 팝업 글자들
    let sparks: Spark[] = []; // 반짝이 입자들
    let stars: BgStar[] = []; // 배경 별들

    // 게임 세계 → React 세계로 통하는 유일한 문.
    // 캔버스는 초당 60번 그려지지만, React는 점수/하트가 "실제로 바뀔 때만" 듣습니다.
    const pushUi = () => setUi({ phase, score, lives, best, eaten });

    // ─────────────────────── ③ 게임의 사건들 ───────────────────────

    /** 쓰레기 하나를 하늘에 새로 등장시킵니다. */
    const spawn = () => {
      // 난이도: 0점 = 0 → 400점 = 1 (그 뒤로는 1로 고정)
      const difficulty = Math.min(1, score / 400);
      // 확률 구간 나누기: 0~1 난수를 자로 재듯 구간으로 나눠 종류를 뽑습니다.
      //  [0 ~ 0.07)   별 7%
      //  [0.07 ~ 0.17+α) 가시 10% → 난이도에 따라 최대 23%까지 확대
      //  나머지        일반 쓰레기
      const roll = Math.random();
      let kind: JunkKind;
      if (roll < 0.07) kind = "star";
      else if (phase === "playing" && roll < 0.17 + difficulty * 0.13) kind = "hazard";
      else kind = pickEdible();
      // ↑ phase 조건: 타이틀 화면(데모)에는 가시가 안 나옵니다.
      //   구경 중인 화면에서 주인공이 찔리면 보기 안 좋으니까요. (연출을 위한 예외)

      const size = kind === "star" ? 15 : kind === "hazard" ? 16 + Math.random() * 8 : 13 + Math.random() * 6;
      // 낙하 속도도 난이도에 따라 최대 2.1배까지 빨라집니다. 타이틀에선 60%로 느긋하게.
      const vy = (55 + Math.random() * 45) * (1 + difficulty * 1.1) * (phase === "playing" ? 1 : 0.6);
      junks.push(makeDebris(kind, w, size, vy));
    };

    /** 꿀꺽! — 빨려 들어가던 쓰레기가 입에 완전히 들어온 순간. */
    const swallow = (j: Debris) => {
      if (j.kind === "star") {
        score += TUNE.starScore;
        sound.star();
        if (lives < TUNE.startLives) {
          // 하트가 닳아 있으면 별이 하트를 회복시켜 줍니다 ♥
          lives++;
          popups.push(makePopup(player.x, player.y - player.r - 18, "+♥", "#ff8fab", 30));
        } else {
          popups.push(makePopup(player.x, player.y - player.r - 18, "+40!", JUNK_COLORS.star, 27));
        }
      } else {
        score += TUNE.junkScore;
        eaten++;
        sound.eat();
        // 먹는 말을 랜덤으로 하나 골라 머리 위에 띄웁니다.
        const word = EAT_WORDS[Math.floor(Math.random() * EAT_WORDS.length)];
        popups.push(makePopup(player.x, player.y - player.r - 16, word, "#ffffff", 24));
      }
      buzz(12); // 폰을 아주 살짝 진동
      burst(sparks, player.x, player.y + player.r * 0.4, JUNK_COLORS[j.kind], 7);
      // 먹으면 커지고 → 커지면 더 잘 먹히는 선순환. 단, 최대 크기 제한!
      player.r = Math.min(TUNE.playerMaxR, player.r + TUNE.growPerEat);
      pushUi(); // 점수가 바뀌었으니 React에게 알림
    };

    /** 게임 끝. 최고 기록이면 저장합니다. */
    const gameOver = () => {
      phase = "over";
      overAt = t; // "언제 죽었는지" 기억 (0.6초 재시작 방지에 사용)
      if (score > best) {
        best = score;
        saveBest(best);
      }
      sound.over();
      pushUi();
    };

    /** 아야! — 가시에 부딪혔을 때. */
    const hit = (j: Debris) => {
      lives--;
      player.invul = TUNE.invulTime; // 무적 시간 시작 — 없으면 가시 하나에 하트가 다 증발해요
      shake = 0.35; // 화면 흔들기 0.35초
      player.r = Math.max(TUNE.playerStartR, player.r - 3); // 아프면 살짝 작아짐
      sound.hit();
      buzz(90); // 아플 때는 좀 더 크게 진동
      burst(sparks, j.x, j.y, JUNK_COLORS.hazard, 10);
      const word = OUCH_WORDS[Math.floor(Math.random() * OUCH_WORDS.length)];
      popups.push(makePopup(player.x, player.y - player.r - 18, word, JUNK_COLORS.hazard, 26));
      if (lives <= 0) gameOver();
      else pushUi();
    };

    /** 새 판 시작 — 모든 것을 처음 상태로 되돌립니다. */
    const start = () => {
      phase = "playing";
      score = 0;
      lives = TUNE.startLives;
      eaten = 0;
      player.r = TUNE.playerStartR;
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

    // ──────────── ④ update(dt) — 매 프레임 세상을 조금씩 움직이기 ────────────
    // 규칙: update는 "세상을 바꾸기만" 하고 캔버스는 절대 건드리지 않습니다.
    //       (그리는 것은 전부 draw 담당. 이 분리가 디버깅을 절반으로 줄여줘요.)
    const update = (dt: number) => {
      // --- 쓰레기 스폰 타이머 (카운트다운 방식) ---
      spawnIn -= dt;
      if (spawnIn <= 0) {
        spawn();
        // 점수가 오를수록 간격이 줄어 빨라지는데, 바닥을 0.42초로 막아
        // 난이도가 무한히 어려워지지는 않게 합니다.
        const base = phase === "playing" ? Math.max(0.42, 1.05 - score / 900) : 1.5;
        // ±30% 랜덤: 정확히 일정한 리듬은 외워져서 지루해집니다. 불규칙성도 설계!
        spawnIn = base * (0.7 + Math.random() * 0.6);
      }

      // --- 주인공 이동: "남은 거리의 일부만큼 다가가기" (지수 감쇠) ---
      // 목표에 가까울수록 이동량이 줄어 자연스럽게 감속합니다. 손맛의 8할!
      if (phase === "playing") {
        const k = Math.min(1, dt * TUNE.followSpeed); // min(1, ...): 렉 걸려도 목표를 지나치지 않게
        player.x += (player.tx - player.x) * k;
        player.y += (player.ty - player.y) * k;
      } else {
        // 타이틀/게임오버에서는 화면 가운데에서 둥둥 떠다닙니다.
        const k = Math.min(1, dt * 2);
        player.x += (w / 2 - player.x) * k;
        player.y += (h * 0.68 + Math.sin(t * 1.8) * 10 - player.y) * k;
      }
      player.invul = Math.max(0, player.invul - dt); // 무적 시간 카운트다운

      // --- 눈 깜빡임 타이머 ---
      player.blink -= dt;
      if (player.blink <= 0) {
        player.blink = 2.2 + Math.random() * 2.5; // 다음 깜빡임은 2.2~4.7초 뒤
        player.blinkT = 0.13; // 0.13초 동안 감고 있기
      }
      player.blinkT = Math.max(0, player.blinkT - dt);

      // --- 제일 가까운 먹이 찾기 (입 벌리기 + 시선 처리용) ---
      let nearest = Infinity;
      let nearestJunk: Debris | null = null;
      for (const j of junks) {
        if (j.eatT >= 0 || j.kind === "hazard") continue; // 먹히는 중이거나 가시는 제외
        const dist = Math.hypot(j.x - player.x, j.y - player.y); // 두 점 사이 거리 (피타고라스)
        if (dist < nearest) {
          nearest = dist;
          nearestJunk = j;
        }
      }
      // 먹이가 사정거리에 들어오면 입을 스르륵 벌립니다 (역시 지수 감쇠로 부드럽게).
      const wantOpen = phase === "playing" && nearestJunk && nearest < player.r + 120 ? 1 : 0;
      player.mouth += (wantOpen - player.mouth) * Math.min(1, dt * 8);
      if (nearestJunk) {
        // 시선 벡터: 먹이 방향을 "길이 1"로 정규화(거리로 나눔)해서 방향만 남깁니다.
        // 그래야 먹이가 멀든 가깝든 눈동자가 눈 밖으로 튀어나가지 않아요.
        const dx = nearestJunk.x - player.x;
        const dy = nearestJunk.y - player.y;
        const dd = Math.hypot(dx, dy) || 1; // || 1: 거리가 0일 때 0으로 나누기 방지
        player.look.x += (dx / dd - player.look.x) * Math.min(1, dt * 6);
        player.look.y += (dy / dd - player.look.y) * Math.min(1, dt * 6);
      }

      const mouthX = player.x;
      const mouthY = player.y + player.r * 0.4; // 입은 몸 중심보다 살짝 아래

      // --- 쓰레기들 갱신 + 충돌 판정 ---
      // ⚠️ 역순(뒤에서부터) 순회: 돌면서 splice로 삭제해도 인덱스가 안 꼬입니다.
      for (let i = junks.length - 1; i >= 0; i--) {
        const j = junks[i];

        // (a) 입으로 빨려 들어가는 중인 녀석
        if (j.eatT >= 0) {
          stepSwallow(j, dt, mouthX, mouthY);
          if (j.eatT >= 1) {
            junks.splice(i, 1); // 배열에서 제거하고
            swallow(j); // 점수·소리·이펙트 발동!
          }
          continue; // 아래의 낙하/충돌 로직은 건너뜀
        }

        // (b) 평범하게 떨어지는 중인 녀석
        stepDebris(j, dt);
        if (j.y > h + 70) {
          junks.splice(i, 1); // 화면 밖으로 나가면 제거 (안 하면 계속 쌓여 느려져요)
          continue;
        }
        if (phase !== "playing") continue; // 타이틀/게임오버 화면에서는 충돌 없음

        const dist = Math.hypot(j.x - player.x, j.y - player.y);
        if (j.kind === "hazard") {
          // 가시의 그림은 뾰족 끝까지 size * 1.5인데 판정은 size * 0.75 —
          // 판정을 그림보다 "훨씬 작게" 잡아서 스치기만 해서는 안 죽습니다.
          // 🎮 황금률: 피격 판정은 보이는 것보다 작게, 획득 판정은 크게!
          if (player.invul <= 0 && dist < player.r + j.size * 0.75) {
            junks.splice(i, 1);
            hit(j);
          }
        } else {
          // 자석 효과: 폰에서 손가락으로 픽셀 단위 조준은 불가능하니
          // 근처에 오면 게임이 슬쩍 끌어당겨 줍니다. (플레이어는 눈치 못 챔!)
          if (dist < player.r + TUNE.magnetRange) {
            const pull = Math.min(1, dt * 3);
            // ⚠️ x가 아니라 x0를 옮깁니다! x는 매 프레임 x0에서 다시 계산되는
            // "파생값"이라 고쳐봤자 다음 프레임에 덮어써져요. 원본을 고쳐야 합니다.
            j.x0 += (player.x - j.x) * pull;
            j.y += (player.y - j.y) * pull;
          }
          // 입을 벌릴수록(+mouth * 10) 먹는 판정이 커집니다. 연출과 판정의 일치!
          if (dist < player.r + j.size * 0.65 + player.mouth * 10) j.eatT = 0; // "먹히기 시작!"
        }
      }

      updatePopups(popups, dt);
      updateSparks(sparks, dt);
      shake = Math.max(0, shake - dt); // 화면 흔들림도 시간이 지나면 잦아듦
    };

    // ──────────────── ⑤ draw() — 현재 세상을 사진 찍듯 그리기 ────────────────
    // 규칙: draw는 "읽기만" 합니다. 게임 상태를 절대 바꾸지 않아요.
    const draw = () => {
      // 손그림 흔들림의 "장면 번호"를 초당 7번만 바꿉니다.
      // → 선이 부글부글 끓는 듯한(boiling) 손그림 애니메이션 효과!
      d.setPhase(Math.floor(t * 7));

      ctx.save();
      if (shake > 0) {
        // 화면 흔들기: 개별 물체가 아니라 "좌표계 전체"를 무작위로 살짝 밀어버립니다.
        const a = (shake / 0.35) * 7; // 남은 시간에 비례해 흔들림도 잦아듦
        ctx.translate((Math.random() - 0.5) * a, (Math.random() - 0.5) * a);
      }

      drawBackdrop(ctx, d, w, h, t, stars);
      for (const j of junks) drawDebris(ctx, d, j, t);

      // 무적 시간에는 초당 8번 반투명으로 깜빡 → "지금 무적이야"라고 알려주는 신호
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

    // ───────────────────── ⑥ 심장: 게임 루프 ─────────────────────
    // "시간을 조금 흘려보내고(update) → 그 순간을 그린다(draw)"의 무한 반복.
    // 이게 모든 게임의 전부입니다. 진짜로!
    const loop = (now: number) => {
      // dt = 지난 프레임부터 흐른 시간(초). 모든 움직임에 dt를 곱하기 때문에
      // 60Hz 모니터든 120Hz 아이패드든 "1초에 같은 거리"를 움직입니다.
      // Math.min(0.05, ...): 탭을 백그라운드에 뒀다 돌아오면 dt가 수십 초가 되어
      // 물체들이 순간이동(터널링)하는데, 상한을 걸어 그 사고를 막습니다.
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      t += dt;
      update(dt);
      draw();
      raf = requestAnimationFrame(loop); // 브라우저에게 "다음 화면 그릴 때 또 불러줘"
    };

    // ───────────────────── ⑦ 입력 처리 ─────────────────────

    /** 손가락/마우스 위치를 주인공의 "목표 지점"으로 삼습니다. */
    const setTarget = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      const px = e.clientX - rect.left; // 화면 좌표 → 캔버스 좌표로 변환
      // 터치일 때는 목표를 72px 위로: 손가락이 주인공을 가리면 안 보이니까요.
      // (마우스 커서는 작아서 그럴 필요가 없음 — pointerType으로 구분)
      const py = e.clientY - rect.top - (e.pointerType === "touch" ? 72 : 0);
      // clamp(가두기): 주인공이 화면 밖이나 상단 점수판 위로 못 나가게 막습니다.
      player.tx = Math.min(Math.max(px, player.r + 6), w - player.r - 6);
      player.ty = Math.min(Math.max(py, player.r + 64), h - player.r - 10);
    };

    const onDown = (e: PointerEvent) => {
      e.preventDefault();
      sound.ensure(); // 🔑 소리는 반드시 "사용자 탭 안에서" 깨워야 브라우저가 허락해요
      if (phase === "title") start();
      else if (phase === "over") {
        // 죽는 순간 화면을 누르고 있던 손가락 때문에 결과를 읽기도 전에
        // 재시작되는 것을 막는 0.6초의 여유. (입력 디바운스)
        if (t - overAt < 0.6) return;
        start();
      }
      setTarget(e);
    };
    const onMove = (e: PointerEvent) => setTarget(e);

    /** 화면 크기가 바뀔 때: 캔버스 버퍼를 다시 맞추고 별도 다시 뿌립니다. */
    const resize = () => {
      ({ w, h } = fitCanvas(canvas, ctx));
      stars = seedStars(w, h, 46);
      if (!player.x) {
        // 최초 1회: 주인공을 화면 가운데 아래쪽에 세워둡니다.
        player.x = w / 2;
        player.y = h * 0.68;
        player.tx = player.x;
        player.ty = player.y;
      }
    };

    // ───────────────────── ⑧ 시동 걸기 ─────────────────────
    resize();
    pushUi();
    window.addEventListener("resize", resize);
    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    raf = requestAnimationFrame(loop); // 루프 출발!

    // useEffect에서 함수를 return하면 = "정리(cleanup) 함수".
    // 이 화면을 떠날 때 React가 불러줍니다. 등록한 것은 반드시 해제!
    // (안 하면 떠난 뒤에도 루프와 리스너가 유령처럼 남아 메모리를 갉아먹어요.)
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      sound.dispose();
    };
  }, []); // ← 빈 배열 = "처음 한 번만 실행"

  // ───────────────────── ⑨ React가 그리는 화면 ─────────────────────
  return (
    <div
      className="fixed inset-0 select-none overflow-hidden bg-[#141838] text-zinc-100"
      // 아이폰에서 길게 눌렀을 때 뜨는 복사 메뉴 끄기
      style={{ WebkitTouchCallout: "none" }}
      // 우클릭/길게 누르기 메뉴 끄기 (게임 중에 뜨면 방해되니까)
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* touch-none이 없으면 브라우저가 드래그를 "스크롤"로 가져가 버려서
          pointermove가 끊깁니다. 게임 캔버스에는 사실상 필수인 클래스! */}
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full touch-none" />

      {/* 아래는 캔버스 위에 겹치는 글자층. 어느 화면(phase)이냐에 따라 갈아 끼웁니다. */}
      {ui.phase !== "title" && <Hud score={ui.score} lives={ui.lives} />}
      {ui.phase === "title" && <TitleScreen best={ui.best} />}
      {ui.phase === "over" && <GameOverScreen score={ui.score} best={ui.best} eaten={ui.eaten} />}
    </div>
  );
}
