/**
 * 🌌 backdrop.ts — 우주 배경 담당 (모눈종이 격자 + 반짝이는 별 + 잠자는 달)
 *
 * 배경은 매 프레임 화면 전체를 덮어 그립니다.
 * 그래서 따로 "지우기"를 하지 않아도 이전 프레임이 자연스럽게 사라져요.
 */

import type { Doodle } from "./doodle";
import { DOODLE_FONT, SPACE_BG } from "./constants";

/** 배경에 박혀 있는 별 하나의 정보. */
export type BgStar = {
  x: number; // 위치
  y: number;
  r: number; // 크기 (반지름)
  cross: boolean; // true면 ＋ 모양, false면 동그란 점
  seed: number; // 별마다 다른 반짝임 타이밍을 주기 위한 고유 번호
  alpha: number; // 기본 밝기 (0~1)
};

/**
 * 화면 곳곳에 별 n개를 무작위로 뿌립니다.
 * Array.from({ length: n }, ...)은 "n칸짜리 배열을 만들면서 각 칸을
 * 함수의 반환값으로 채워줘"라는, 배열 생성의 단골 패턴입니다.
 */
export const seedStars = (w: number, h: number, n: number): BgStar[] =>
  Array.from({ length: n }, () => ({
    x: Math.random() * w,
    y: Math.random() * h,
    r: Math.random() * 1.6 + 0.6, // 0.6 ~ 2.2 픽셀
    cross: Math.random() < 0.28, // 28% 확률로 ＋ 모양 별
    seed: Math.random() * 10,
    alpha: 0.25 + Math.random() * 0.45,
  }));

/** 우주 배경 전체(바탕색 → 격자 → 별들 → 달)를 그립니다. */
export function drawBackdrop(
  ctx: CanvasRenderingContext2D,
  d: Doodle,
  w: number, // 화면 폭
  h: number, // 화면 높이
  t: number, // 게임 시작 후 흐른 시간(초) — 반짝임 애니메이션에 사용
  stars: BgStar[],
) {
  // 바탕색을 화면보다 12px씩 "더 크게" 칠합니다.
  // 화면 흔들기(shake) 효과로 좌표계가 밀렸을 때 가장자리에
  // 빈 틈이 보이는 걸 막기 위해서예요.
  ctx.fillStyle = SPACE_BG;
  ctx.fillRect(-12, -12, w + 24, h + 24);

  // 아주 연한 모눈종이 격자 (48px 간격). "노트에 그린 낙서" 분위기의 핵심!
  ctx.strokeStyle = "rgba(255,255,255,0.045)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let gx = 0; gx <= w; gx += 48) {
    ctx.moveTo(gx, 0);
    ctx.lineTo(gx, h);
  }
  for (let gy = 0; gy <= h; gy += 48) {
    ctx.moveTo(0, gy);
    ctx.lineTo(w, gy);
  }
  ctx.stroke();

  // 별들. sin(t)로 밝기를 흔들어 반짝이게 합니다.
  // + s.seed 덕분에 별마다 반짝이는 타이밍이 달라서 자연스러워요.
  ctx.lineWidth = 1.5;
  for (const s of stars) {
    ctx.globalAlpha = s.alpha * (0.7 + 0.3 * Math.sin(t * 1.5 + s.seed));
    if (s.cross) {
      // ＋ 모양 별: 가로선 + 세로선
      const l = s.r * 3;
      ctx.strokeStyle = "#fff7d6";
      ctx.beginPath();
      ctx.moveTo(s.x - l, s.y);
      ctx.lineTo(s.x + l, s.y);
      ctx.moveTo(s.x, s.y - l);
      ctx.lineTo(s.x, s.y + l);
      ctx.stroke();
    } else {
      // 동그란 점 별
      ctx.fillStyle = "#fff7d6";
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1; // 투명도를 썼으면 꼭 원래대로 되돌리기!

  // 잠자는 달 🌙 (오른쪽 위)
  const mx = w * 0.85;
  const my = h * 0.14;
  ctx.lineWidth = 3;
  d.wobblyBlob(mx, my, 26, 5.5, 1.8); // 삐뚤빼뚤한 동그라미 몸통
  d.fillStroke("#ffe9a8", 0.12);
  // 감은 눈 두 개: 아래로 볼록한 호(arc)를 그리면 "자는 눈"이 됩니다.
  ctx.strokeStyle = "#ffe9a8";
  ctx.lineWidth = 2.5;
  for (const dir of [-1, 1] as const) {
    ctx.beginPath();
    ctx.arc(mx + dir * 8, my - 2, 4, Math.PI * 0.15, Math.PI * 0.85);
    ctx.stroke();
  }
  // 동그란 입
  ctx.beginPath();
  ctx.arc(mx, my + 9, 2.5, 0, Math.PI * 2);
  ctx.stroke();
  // 잠꼬대 "z z" — sin으로 밝아졌다 어두워졌다 하며 숨쉬듯 깜빡입니다.
  ctx.globalAlpha = 0.5 + 0.5 * Math.sin(t * 2);
  ctx.font = `700 15px ${DOODLE_FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#ffe9a8";
  ctx.fillText("z", mx + 26, my - 24);
  ctx.fillText("z", mx + 35, my - 34);
  ctx.globalAlpha = 1;
}
