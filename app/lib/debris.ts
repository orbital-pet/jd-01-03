/**
 * 🛰️ debris.ts — 하늘에서 떨어지는 우주쓰레기 담당
 *
 * 쓰레기 하나의 일생:
 *   makeDebris()로 태어나서 → 매 프레임 stepDebris()로 떨어지고 →
 *   입에 닿으면 stepSwallow()로 빨려 들어가고 → drawDebris()로 그려집니다.
 *
 * "데이터(Debris 객체)"와 "그 데이터를 움직이고 그리는 함수"를 나눠 두는 것이
 * 이 게임의 기본 설계입니다. 클래스 없이 평범한 객체와 함수만 씁니다.
 */

import type { Doodle } from "./doodle";
import { JUNK_COLORS, type JunkKind } from "./constants";

/** 떨어지는 물체 하나의 상태. */
export type Debris = {
  kind: JunkKind; // 종류 (위성/볼트/캔/스프링/별/가시)
  /**
   * ⚠️ 중요! x0는 "좌우 흔들림의 중심축"입니다.
   * 실제 위치 x는 매 프레임 x0로부터 다시 계산되기 때문에(stepDebris 참고),
   * 물체를 옆으로 옮기고 싶으면 x가 아니라 반드시 x0를 바꿔야 합니다.
   * (x를 바꿔봤자 다음 프레임에 바로 덮어써져요. 초보자가 100% 밟는 지뢰!)
   */
  x0: number;
  x: number; // 실제 그려지는 위치 (x0에서 파생되어 계산됨)
  y: number;
  vy: number; // 떨어지는 속도 (초당 픽셀)
  swayAmp: number; // 좌우 흔들림의 폭
  swayT: number; // 좌우 흔들림의 현재 각도 (sin에 넣는 값)
  swaySpeed: number; // 좌우 흔들림의 빠르기
  rot: number; // 현재 회전 각도 (라디안)
  vrot: number; // 회전 속도 (초당 라디안)
  size: number; // 크기
  seed: number; // 이 물체만의 고유 번호 (손그림 흔들림용)
  /**
   * 먹기 진행도. 숫자 하나로 두 가지 상태를 표현하는 요령:
   *   -1     = 자유롭게 떠다니는 중
   *   0 ~ 1  = 입으로 빨려 들어가는 중 (1이 되면 꿀꺽!)
   */
  eatT: number;
};

/** 새 쓰레기 하나를 화면 위쪽 바깥(y = -60)에서 만들어냅니다. */
export function makeDebris(kind: JunkKind, w: number, size: number, vy: number): Debris {
  // 좌우 가장자리에 딱 붙지 않게 34px씩 여유를 두고 무작위 x 위치를 뽑습니다.
  const x0 = 34 + Math.random() * Math.max(40, w - 68);
  return {
    kind,
    x0,
    x: x0,
    y: -60, // 화면 위 바깥에서 시작 → 스르륵 등장하는 것처럼 보임
    vy,
    swayAmp: 10 + Math.random() * 24,
    swayT: Math.random() * Math.PI * 2, // 시작 각도를 흩어놓아 제각각 흔들리게
    swaySpeed: 0.8 + Math.random() * 1.4,
    rot: Math.random() * Math.PI * 2,
    vrot: (Math.random() - 0.5) * 1.6, // -0.8 ~ +0.8 : 시계/반시계 랜덤
    size,
    seed: Math.random() * 100,
    eatT: -1, // 태어날 때는 "먹히는 중 아님"
  };
}

/** 매 프레임: 아래로 떨어지면서 좌우로 하늘하늘 + 빙글빙글. */
export function stepDebris(j: Debris, dt: number) {
  j.swayT += j.swaySpeed * dt;
  j.x = j.x0 + Math.sin(j.swayT) * j.swayAmp; // x는 늘 "중심축 + 흔들림"으로 재계산!
  j.y += j.vy * dt; // "초당 vy픽셀" × "흐른 시간" = 프레임 속도와 무관하게 일정한 낙하
  j.rot += j.vrot * dt;
}

/** 먹히는 중: 입 쪽으로 쭉 빨려 들어가며 빠르게 회전. (0.16초 만에 완료) */
export function stepSwallow(j: Debris, dt: number, mouthX: number, mouthY: number) {
  j.eatT += dt / 0.16; // 0 → 1까지 0.16초
  const k = Math.min(1, dt * 20); // 아주 빠른 "따라가기" 계수
  j.x += (mouthX - j.x) * k; // 남은 거리의 일부만큼 입으로 접근 (지수 감쇠)
  j.y += (mouthY - j.y) * k;
  j.rot += j.vrot * 6 * dt; // 평소의 6배로 빙글빙글!
}

/**
 * 쓰레기 하나를 화면에 그립니다.
 * translate(이동) → rotate(회전) → scale(확대/축소)로 좌표계를 옮겨 놓고,
 * 도형 자체는 (0, 0)을 중심으로 그립니다. 이렇게 하면 그리는 코드가
 * "지금 어디에 있는지, 몇 도 돌아갔는지"를 몰라도 되어서 훨씬 단순해져요.
 */
export function drawDebris(ctx: CanvasRenderingContext2D, d: Doodle, j: Debris, t: number) {
  ctx.save(); // 좌표계를 백업하고
  ctx.translate(j.x, j.y);
  ctx.rotate(j.rot);
  // 먹히는 중이면 eatT(0→1)에 따라 크기를 1→0.05로 줄입니다. 꿀꺽!
  const sc = j.eatT >= 0 ? Math.max(0.05, 1 - j.eatT) : 1;
  ctx.scale(sc, sc);
  drawJunkShape(ctx, d, j.kind, j.size, j.seed, t);
  ctx.restore(); // 반드시 복원! 안 하면 다음 물체까지 같이 회전합니다.
}

/**
 * 종류별 생김새. 현재 좌표계의 원점 (0, 0)을 중심으로 그립니다.
 *
 * 눈여겨볼 점:
 *  - 모든 치수가 s(크기)의 배수예요. 하드코딩된 픽셀이 없어서
 *    s만 바꾸면 비율이 유지된 채 커지고 작아집니다. (비례 기반 디자인)
 *  - seed + 1, seed + 7처럼 부품마다 시드를 다르게 줍니다. 같은 시드를 주면
 *    좌우 부품이 똑같은 방향으로 삐뚤어져서 부자연스럽거든요.
 */
export function drawJunkShape(
  ctx: CanvasRenderingContext2D,
  d: Doodle,
  kind: JunkKind,
  s: number,
  seed: number,
  t: number,
) {
  const c = JUNK_COLORS[kind];
  ctx.lineWidth = 3;

  switch (kind) {
    case "satellite": {
      // 인공위성: 좌우 태양전지판은 대칭이니 [-1, 1] 루프로 한 번에.
      for (const dir of [-1, 1] as const) {
        const px = dir === 1 ? s * 0.85 : -s * 1.95;
        d.wobblyPath(d.rectPts(px, -s * 0.38, s * 1.1, s * 0.76), seed + dir, 1.5, true);
        d.fillStroke("#ffd166", 0.13); // 노란 패널
        d.wobblyLine(px + s * 0.55, -s * 0.38, px + s * 0.55, s * 0.38, seed + 3 + dir, 1.1);
        d.strokeOnly("#ffd166"); // 패널 가운데 분할선
      }
      // 본체 상자
      d.wobblyPath(d.rectPts(-s * 0.75, -s * 0.55, s * 1.5, s * 1.1), seed + 7, 1.6, true);
      d.fillStroke(c);
      // 머리 위 안테나 + 끝의 동그라미
      d.wobblyLine(0, -s * 0.55, 0, -s * 1.05, seed + 8, 1);
      d.strokeOnly(c);
      ctx.beginPath();
      ctx.arc(0, -s * 1.15, 2.6, 0, Math.PI * 2);
      d.strokeOnly(c);
      // 점 두 개(눈) + 호 하나(웃는 입) = 위성도 귀엽게!
      ctx.fillStyle = "#eaf6ff";
      ctx.beginPath();
      ctx.arc(-s * 0.24, -s * 0.12, 1.8, 0, Math.PI * 2);
      ctx.arc(s * 0.24, -s * 0.12, 1.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(0, s * 0.08, s * 0.2, Math.PI * 0.2, Math.PI * 0.8);
      ctx.strokeStyle = "#eaf6ff";
      ctx.lineWidth = 2;
      ctx.stroke();
      break;
    }
    case "bolt": {
      // 볼트: 육각형(ngonPts 6) 안에 동그란 구멍(blob)
      d.wobblyPath(d.ngonPts(6, s, seed), seed, 1.6, true);
      d.fillStroke(c);
      d.wobblyBlob(0, 0, s * 0.42, seed + 9, 1.1);
      d.strokeOnly(c);
      break;
    }
    case "can": {
      // 음료수 캔: 세로로 긴 사각형 + 위아래 띠
      d.wobblyPath(d.rectPts(-s * 0.55, -s * 0.8, s * 1.1, s * 1.6), seed, 1.6, true);
      d.fillStroke(c);
      d.wobblyLine(-s * 0.55, -s * 0.42, s * 0.55, -s * 0.42, seed + 2, 1.1);
      d.strokeOnly(c);
      d.wobblyLine(-s * 0.55, s * 0.4, s * 0.55, s * 0.4, seed + 3, 1.1);
      d.strokeOnly(c);
      // X자 눈 두 개 (다 마셔서 기절한 캔...)
      ctx.lineWidth = 2;
      ctx.strokeStyle = "#fff0f6";
      for (const dir of [-1, 1] as const) {
        const ex = dir * s * 0.22;
        ctx.beginPath();
        ctx.moveTo(ex - 2.4, -s * 0.1 - 2.4);
        ctx.lineTo(ex + 2.4, -s * 0.1 + 2.4);
        ctx.moveTo(ex + 2.4, -s * 0.1 - 2.4);
        ctx.lineTo(ex - 2.4, -s * 0.1 + 2.4);
        ctx.stroke();
      }
      // 일자 입
      d.wobblyLine(-s * 0.14, s * 0.18, s * 0.14, s * 0.18, seed + 6, 0.7);
      ctx.stroke();
      break;
    }
    case "spring": {
      // 스프링: 좌우로 왔다갔다하는 지그재그 선
      const pts: [number, number][] = [[-s * 0.3, -s * 0.85]];
      for (let i = 0; i < 6; i++) {
        // i가 짝수면 오른쪽(+), 홀수면 왼쪽(-) — 지그재그의 원리
        pts.push([(i % 2 === 0 ? 1 : -1) * s * 0.45, -s * 0.65 + (i / 5) * s * 1.3]);
      }
      pts.push([s * 0.3, s * 0.85]);
      d.wobblyPath(pts, seed, 1.3, false); // close=false: 열린 선
      d.strokeOnly(c);
      break;
    }
    case "star": {
      // 보너스 별: sin으로 크기가 두근두근 뛰는 맥박 효과
      const pulse = 1 + Math.sin(t * 5 + seed) * 0.08;
      d.wobblyPath(d.spikyPts(5, s * 0.45 * pulse, s * pulse), seed, 1.2, true);
      d.fillStroke(c, 0.25);
      // 옆의 작은 + 반짝임 (밝기가 깜빡깜빡)
      ctx.globalAlpha = 0.4 + 0.4 * Math.sin(t * 7 + seed);
      ctx.lineWidth = 2;
      ctx.strokeStyle = c;
      ctx.beginPath();
      ctx.moveTo(s * 1.05, -s * 0.95);
      ctx.lineTo(s * 1.45, -s * 0.95);
      ctx.moveTo(s * 1.25, -s * 1.15);
      ctx.lineTo(s * 1.25, -s * 0.75);
      ctx.stroke();
      ctx.globalAlpha = 1;
      break;
    }
    case "hazard": {
      // 가시덩어리: 9개 가시가 숨쉬듯 늘었다 줄었다 하는 뾰족 도형
      const rOut = s * (1.5 + Math.sin(t * 6 + seed) * 0.12);
      d.wobblyPath(d.spikyPts(9, s, rOut), seed, 1.4, true);
      d.fillStroke(c, 0.18);
      // 화난 눈썹 두 줄
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = c;
      for (const dir of [-1, 1] as const) {
        ctx.beginPath();
        ctx.moveTo(dir * s * 0.45, -s * 0.32);
        ctx.lineTo(dir * s * 0.12, -s * 0.14);
        ctx.stroke();
      }
      // 점 눈 + 뾰로통한 입 (호를 위쪽으로 그리면 시무룩한 입이 됩니다)
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.arc(-s * 0.24, s * 0.02, 2, 0, Math.PI * 2);
      ctx.arc(s * 0.24, s * 0.02, 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(0, s * 0.5, s * 0.24, Math.PI * 1.2, Math.PI * 1.8);
      ctx.stroke();
      break;
    }
  }
}
