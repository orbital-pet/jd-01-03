/**
 * 😋 mascot.ts — 주인공(입 큰 민트색 친구)을 그리는 파일
 *
 * "귀여움"은 우연이 아니라 장치들의 합입니다:
 *   ① 눈동자가 가장 가까운 먹이를 쳐다봄 (lookX/lookY)
 *   ② 2~5초마다 0.13초씩 눈을 깜빡임 (blinkT)
 *   ③ 분홍 볼터치 — 이거 하나로 체온이 생겨요
 *   ④ 먹이가 가까우면 입이 스르륵 벌어짐 (mouth 0→1)
 * 하나씩 지워 보면 각각이 얼마나 큰 역할을 하는지 알 수 있습니다.
 */

import type { Doodle } from "./doodle";
import { MASCOT } from "./constants";

/** 마스코트를 그리는 데 필요한 "지금 이 순간의 모습" 정보. */
export type MascotPose = {
  x: number; // 위치
  y: number;
  r: number; // 몸통 반지름 (먹을수록 커져요)
  t: number; // 흐른 시간(초) — 안테나 흔들림 등에 사용
  mouth: number; // 입 벌림 정도: 0 = 다문 미소, 1 = 활짝
  blinkT: number; // 0보다 크면 눈 감는 중
  lookX: number; // 시선 방향 (길이 1짜리 방향 벡터)
  lookY: number;
};

/** 마스코트를 화면에 그립니다. (매 프레임 호출) */
export function drawMascot(ctx: CanvasRenderingContext2D, d: Doodle, p: MascotPose) {
  const { x, y, r, t } = p; // 구조 분해: p.x 대신 x로 짧게 쓰기 위한 문법
  ctx.save();
  ctx.lineWidth = 4;

  // --- 안테나: sin 두 개로 흐느적흐느적 ---
  const bobY = Math.sin(t * 3 + 1) * 2.5; // 위아래 출렁임
  const ax = x + Math.sin(t * 2) * 3; // 좌우 흔들림 (속도가 달라 자연스러움)
  d.wobblyLine(x, y - r + 4, ax, y - r - 15 + bobY, 31, 1.3);
  d.strokeOnly(MASCOT.body);
  ctx.beginPath();
  ctx.arc(ax, y - r - 18 + bobY, 3.4, 0, Math.PI * 2); // 끝의 노란 구슬
  ctx.fillStyle = MASCOT.antenna;
  ctx.fill();
  ctx.lineWidth = 2.5;
  d.strokeOnly(MASCOT.body);
  ctx.lineWidth = 4;

  // --- 몸통: 삐뚤빼뚤한 동그라미 ---
  // 채움 투명도 0.34: 기본값(0.15)으로는 어두운 우주 배경에서 몸이 거의 안 보여서
  // 유령처럼 됐던 것을 튜닝한 값입니다. 배경색과 채움 투명도는 항상 같이 조정!
  d.wobblyBlob(x, y, r, 7.7, r * 0.06);
  d.fillStroke(MASCOT.body, 0.34);

  // --- 눈 두 개 (좌우 대칭이니 [-1, 1] 루프) ---
  const er = r * 0.2; // 눈 크기도 몸 크기에 비례
  for (const dir of [-1, 1] as const) {
    const cx = x + dir * r * 0.34;
    const cy = y - r * 0.3;
    if (p.blinkT > 0) {
      // 감은 눈: 아래로 볼록한 호 하나면 충분합니다. ( ˘ ω ˘ )
      ctx.beginPath();
      ctx.arc(cx, cy + 1, er * 0.7, Math.PI * 0.15, Math.PI * 0.85);
      ctx.strokeStyle = MASCOT.ink;
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.lineWidth = 4;
    } else {
      // 뜬 눈: 흰자(타원) + 눈동자(원)
      ctx.beginPath();
      ctx.ellipse(cx, cy, er * 0.78, er, 0, 0, Math.PI * 2);
      ctx.fillStyle = MASCOT.eye;
      ctx.fill();
      ctx.strokeStyle = MASCOT.ink;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.lineWidth = 4;
      // 눈동자를 시선 방향(lookX/lookY)으로 살짝 이동 → 먹이를 쳐다봅니다.
      // look은 길이 1로 정규화된 벡터라 눈 밖으로 튀어나갈 일이 없어요.
      ctx.beginPath();
      ctx.arc(cx + p.lookX * er * 0.32, cy + p.lookY * er * 0.35, er * 0.42, 0, Math.PI * 2);
      ctx.fillStyle = MASCOT.ink;
      ctx.fill();
    }
  }

  // --- 볼터치: 반투명 분홍 타원 두 개 ---
  // globalAlpha에 "곱하는" 이유: 무적 깜빡임 중(전체가 0.4로 흐려짐)에도
  // 볼터치만 진하게 남는 버그를 막기 위해서입니다.
  const ga = ctx.globalAlpha;
  ctx.globalAlpha = ga * 0.4;
  ctx.fillStyle = MASCOT.blush;
  for (const dir of [-1, 1] as const) {
    ctx.beginPath();
    ctx.ellipse(x + dir * r * 0.62, y - r * 0.02, r * 0.15, r * 0.1, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = ga;

  // --- 입: mouth 값(0~1)에 따라 미소 ↔ 활짝 벌린 입 ---
  const m = p.mouth;
  const my = y + r * 0.42;
  if (m > 0.15) {
    // 벌린 입: 검은 타원 구멍 + 분홍 혀
    const mrx = r * (0.2 + 0.35 * m); // 가로 반지름 (벌릴수록 커짐)
    const mry = r * (0.1 + 0.42 * m); // 세로 반지름
    // wobblyBlob은 원만 그릴 수 있어서, 좌표계의 세로축을 mry/mrx 배율로
    // 찌그러뜨린 상태에서 원을 그립니다 → 화면에는 타원으로 보여요!
    // (함수를 고치지 않고 좌표계를 바꿔서 재활용하는 요령)
    ctx.save();
    ctx.translate(x, my);
    ctx.scale(1, mry / mrx);
    d.wobblyBlob(0, 0, mrx, 3.3, 1.4);
    ctx.restore();
    ctx.fillStyle = MASCOT.ink;
    ctx.fill();
    ctx.lineWidth = 3;
    d.strokeOnly(MASCOT.ink);
    ctx.lineWidth = 4;
    // 혀
    ctx.beginPath();
    ctx.ellipse(x, my + mry * 0.4, mrx * 0.5, mry * 0.32, 0, 0, Math.PI * 2);
    ctx.fillStyle = MASCOT.blush;
    ctx.fill();
  } else {
    // 다문 입: 아래로 볼록한 호 = 빙그레 미소
    ctx.beginPath();
    ctx.arc(x, my - r * 0.08, r * 0.24, Math.PI * 0.2, Math.PI * 0.8);
    ctx.strokeStyle = MASCOT.ink;
    ctx.lineWidth = 3;
    ctx.stroke();
  }
  ctx.restore();
}
