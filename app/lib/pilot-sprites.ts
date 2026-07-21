// ============================================================================
// pilot-sprites — SVG 이미지 로더 (수동 조종 미니게임용)
//
// 엔티티(우주선·잔해·위험물·연료셀)는 `public/plan/img/`의 SVG로 그린다.
// 브라우저는 public 아래 파일을 `/plan/img/<name>.svg` 경로로 서빙한다.
// 이미지가 아직 없거나 로드에 실패해도 게임은 멈추지 않는다 — drawSprite가
// 종류별 폴백 도형을 대신 그려준다. 그림만 나중에 채워 넣으면 된다.
// ============================================================================

export type PilotKind = "ship" | "chip" | "bolt" | "tank" | "hazard" | "fuel";

/** 종류 → 서빙 경로. 파일명을 바꾸면 여기만 고치면 된다. */
export const SPRITE_SRC: Record<PilotKind, string> = {
  ship: "/plan/img/ship.svg",
  chip: "/plan/img/debris-chip.svg",
  bolt: "/plan/img/debris-bolt.svg",
  tank: "/plan/img/debris-tank.svg",
  hazard: "/plan/img/hazard.svg",
  fuel: "/plan/img/fuel.svg",
};

/** 폴백 도형 색 — 이미지가 없을 때 종류를 구분해 보여준다. */
const FALLBACK_COLOR: Record<PilotKind, string> = {
  ship: "#7ee8b2",
  chip: "#8ecbff",
  bolt: "#cfd8e6",
  tank: "#f9a8d4",
  hazard: "#ff8080",
  fuel: "#66fcf1",
};

export type SpriteBank = Record<PilotKind, HTMLImageElement | null>;

/**
 * 모든 SVG를 미리 불러온다. 로드가 끝날 때마다 onReady로 알려 첫 프레임에
 * 늦게 도착한 그림도 자연스럽게 나타나게 한다. (SSR에서는 빈 뱅크를 돌려준다)
 */
export function loadSprites(onReady?: () => void): SpriteBank {
  const bank = {} as SpriteBank;
  if (typeof window === "undefined") {
    (Object.keys(SPRITE_SRC) as PilotKind[]).forEach((k) => (bank[k] = null));
    return bank;
  }
  for (const kind of Object.keys(SPRITE_SRC) as PilotKind[]) {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => onReady?.();
    img.onerror = () => {
      bank[kind] = null; // 폴백 도형으로 넘어간다
    };
    img.src = SPRITE_SRC[kind];
    bank[kind] = img;
  }
  return bank;
}

const ready = (img: HTMLImageElement | null): img is HTMLImageElement =>
  !!img && img.complete && img.naturalWidth > 0;

/**
 * (cx, cy)를 중심으로 지정 크기(px, 한 변)로 스프라이트를 그린다. rot(라디안)만큼
 * 회전. 이미지가 준비되지 않았으면 종류별 폴백 도형을 그린다. 호출자는 save/restore를
 * 신경 쓸 필요 없다 — 내부에서 좌표계를 복원한다.
 */
export function drawSprite(
  ctx: CanvasRenderingContext2D,
  bank: SpriteBank,
  kind: PilotKind,
  cx: number,
  cy: number,
  px: number,
  rot = 0,
) {
  ctx.save();
  ctx.translate(cx, cy);
  if (rot) ctx.rotate(rot);
  const img = bank[kind];
  if (ready(img)) {
    ctx.drawImage(img, -px / 2, -px / 2, px, px);
  } else {
    drawFallback(ctx, kind, px);
  }
  ctx.restore();
}

/** 이미지가 없을 때의 임시 도형. 원점 중심, 한 변 px. */
function drawFallback(ctx: CanvasRenderingContext2D, kind: PilotKind, px: number) {
  const r = px / 2;
  const c = FALLBACK_COLOR[kind];
  ctx.lineWidth = 3;
  ctx.strokeStyle = "rgba(0,0,0,0.35)";
  ctx.fillStyle = c;
  if (kind === "hazard") {
    ctx.beginPath();
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2 - Math.PI / 2;
      const rr = i % 2 === 0 ? r : r * 0.5;
      const fn = i === 0 ? "moveTo" : "lineTo";
      ctx[fn](Math.cos(a) * rr, Math.sin(a) * rr);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else if (kind === "fuel" || kind === "tank" || kind === "chip") {
    const w = px * 0.7;
    const h = kind === "chip" ? px * 0.7 : px * 0.9;
    ctx.beginPath();
    ctx.rect(-w / 2, -h / 2, w, h);
    ctx.fill();
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.85, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
}
