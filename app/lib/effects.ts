/**
 * ✨ effects.ts — 연출 담당: 팝업 글자("냠!")와 반짝이 입자(스파크)
 *
 * 둘 다 같은 "수명 기반" 설계를 씁니다:
 *
 *   age(나이)와 life(수명) 두 필드만 있으면
 *   - age += dt 로 나이를 먹고
 *   - age >= life 가 되면 배열에서 제거하고
 *   - age / life (0→1로 가는 진행도)를 투명도·위치 등에 곱해 애니메이션합니다.
 *
 * 이 공식은 게임 이펙트의 만능 재료예요. 꼭 기억해 두세요!
 */

import type { Doodle } from "./doodle";
import { DOODLE_FONT, SPACE_BG } from "./constants";

// ------------------------------------------------------- 팝업 글자 ("냠!", "아야!")

/** 머리 위로 뿅 떠오르는 글자 하나. */
export type Popup = {
  x: number;
  y: number;
  text: string; // 표시할 글자
  age: number; // 태어난 뒤 흐른 시간(초)
  life: number; // 수명(초)
  color: string;
  size: number; // 글자 크기(px)
  seed: number; // 글자마다 다른 기울기를 주기 위한 고유 번호
};

/** 팝업 글자를 하나 만듭니다. (수명 0.85초) */
export const makePopup = (x: number, y: number, text: string, color: string, size: number): Popup => ({
  x,
  y,
  text,
  age: 0,
  life: 0.85,
  color,
  size,
  seed: Math.random() * 10,
});

/**
 * 매 프레임: 위로 떠오르며 나이를 먹고, 수명이 다하면 제거합니다.
 *
 * ⚠️ 배열을 "뒤에서부터" 도는 이유: 순회 중에 splice로 삭제하면
 * 뒤의 요소들이 한 칸씩 앞으로 당겨집니다. 앞에서부터 돌면 당겨진 요소를
 * 건너뛰는 버그가 생겨요. 뒤에서부터 돌면 아직 검사 안 한 앞쪽 인덱스는
 * 영향을 받지 않아 안전합니다. (삭제하며 순회할 때의 철칙!)
 */
export function updatePopups(popups: Popup[], dt: number) {
  for (let i = popups.length - 1; i >= 0; i--) {
    const p = popups[i];
    p.age += dt;
    p.y -= 34 * dt; // 초당 34px씩 위로
    if (p.age >= p.life) popups.splice(i, 1);
  }
}

/** 팝업 글자들을 그립니다. */
export function drawPopups(ctx: CanvasRenderingContext2D, d: Doodle, popups: Popup[]) {
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (const p of popups) {
    const f = p.age / p.life; // 진행도 0 → 1
    ctx.save();
    // 처음 70%는 완전 불투명, 마지막 30%에서만 사라집니다.
    // 처음부터 서서히 흐려지면 글자를 읽기도 전에 반투명이 되거든요.
    // "충분히 보여준 다음 사라진다" — 텍스트 피드백의 기본기!
    ctx.globalAlpha = f < 0.7 ? 1 : 1 - (f - 0.7) / 0.3;
    ctx.translate(p.x, p.y);
    ctx.rotate(d.wob(p.seed, 1) * 0.1); // 글자마다 살짝 다른 기울기
    ctx.font = `700 ${p.size}px ${DOODLE_FONT}`;
    // 배경색으로 두꺼운 테두리를 먼저 긋고 그 위에 글자를 채우면
    // 어떤 그림 위에서도 글자가 또렷하게 읽힙니다. (지도 라벨, 자막의 기법)
    ctx.lineWidth = 5;
    ctx.strokeStyle = SPACE_BG;
    ctx.strokeText(p.text, 0, 0);
    ctx.fillStyle = p.color;
    ctx.fillText(p.text, 0, 0);
    ctx.restore();
  }
}

// ------------------------------------------------------- 반짝이 입자 (스파크)

/** 먹거나 부딪힐 때 사방으로 튀는 작은 점 하나. */
export type Spark = {
  x: number;
  y: number;
  vx: number; // 속도 (초당 픽셀)
  vy: number;
  age: number;
  life: number;
  color: string;
  r: number; // 점의 크기
};

/**
 * (x, y)에서 입자 n개를 사방으로 터뜨립니다.
 * "무작위 각도 + 무작위 속력 → 속도 벡터(vx, vy)" 는
 * 폭발/분출 이펙트의 표준 공식입니다:
 *   vx = cos(각도) × 속력,  vy = sin(각도) × 속력
 */
export function burst(sparks: Spark[], x: number, y: number, color: string, n: number) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2; // 0~360도 아무 방향
    const sp = 40 + Math.random() * 120; // 속력 40~160 px/초
    sparks.push({
      x,
      y,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp,
      age: 0,
      life: 0.4 + Math.random() * 0.25,
      color,
      r: 1.5 + Math.random() * 2,
    });
  }
}

/** 매 프레임: 날아가며 나이를 먹고, 수명이 다하면 제거. (역순 순회 — 위 참고) */
export function updateSparks(sparks: Spark[], dt: number) {
  for (let i = sparks.length - 1; i >= 0; i--) {
    const s = sparks[i];
    s.age += dt;
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    if (s.age >= s.life) sparks.splice(i, 1);
  }
}

/** 입자들을 그립니다. 나이가 들수록(age/life ↑) 점점 투명해집니다. */
export function drawSparks(ctx: CanvasRenderingContext2D, sparks: Spark[]) {
  for (const s of sparks) {
    ctx.globalAlpha = Math.max(0, 1 - s.age / s.life);
    ctx.fillStyle = s.color;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1; // 투명도 원상 복구를 잊지 마세요!
}
