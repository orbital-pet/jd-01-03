// ============================================================================
// pilot-sprites — SVG 이미지 캐시 + 자산 레지스트리 (수동 조종 미니게임용)
//
// 자산은 satellite_pet_svg_pack 을 통째로 `public/plan/img/pack/` 아래에 두고,
// 브라우저가 `/plan/img/pack/...` 로 서빙한다. 여기서는 (1) 경로를 만드는 헬퍼와
// (2) HTMLImageElement 를 한 번만 만들어 캐시하는 로더, (3) 캔버스에 중앙 정렬로
// 그리는 drawImg 를 제공한다. 로드 실패해도 게임은 멈추지 않는다 — drawImg 가
// false 를 돌려주므로 호출부가 폴백 도형을 대신 그리면 된다.
// ============================================================================

const PACK = "/plan/img/pack";

export const BG = `${PACK}/background/bg_space_portrait.svg`;
export const STARS_TILE = `${PACK}/background/stars_tile.svg`;

/** 감정 프리베이크 변형 (파일명 접미사) + "normal"(기본 포즈) */
export type Emotion =
  | "normal"
  | "happy"
  | "low_battery"
  | "sulky"
  | "hibernate"
  | "powersave"
  | "data_full";

/** 진화 단계 — 3단계 모습은 스킨(자석/그물/레이저)으로 선택 */
export type Stage = 1 | 2 | 3;
export type Stage3Skin = "magnet" | "net" | "laser";
export const STAGE3_SKINS: Stage3Skin[] = ["magnet", "net", "laser"];
export const SKIN_KEY = "sjs-skin";
export const SKIN_LABEL: Record<Stage3Skin, string> = {
  magnet: "자석",
  net: "그물",
  laser: "레이저",
};

const STAGE12: Record<1 | 2, string> = { 1: "pet_stage1_baby", 2: "pet_stage2_junior" };
const STAGE3_FILE: Record<Stage3Skin, string> = {
  magnet: "pet_stage3_magnet",
  net: "pet_stage3_net",
  laser: "pet_stage3_laser",
};

export function petSrc(stage: Stage, emo: Emotion, skin: Stage3Skin = "magnet"): string {
  const base = stage === 3 ? STAGE3_FILE[skin] : STAGE12[stage];
  return emo === "normal"
    ? `${PACK}/characters/${base}.svg`
    : `${PACK}/characters/emotions/${base}__${emo}.svg`;
}

export function droneSrc(emo: Emotion = "happy"): string {
  return emo === "normal"
    ? `${PACK}/characters/support_drone.svg`
    : `${PACK}/characters/emotions/support_drone__${emo}.svg`;
}

export const debrisSrc = (name: string) => `${PACK}/debris/${name}.svg`;

/** 크기 티어별 잔해 그림 후보 — 스폰 때 하나를 골라 다양성을 준다 */
export const DEBRIS_SPRITES = {
  small: ["chip", "nut", "antenna_piece"],
  medium: ["bolt", "gear"],
  large: ["solar_fragment"],
};

export const FUEL_SRC = `${PACK}/debris/fuel_tank.svg`;

export const FX = {
  ring: `${PACK}/effects/fx_collect_ring.svg`,
  sparkle: `${PACK}/effects/fx_sparkle.svg`,
  heart: `${PACK}/effects/fx_heart_pop.svg`,
  alert: `${PACK}/effects/fx_alert.svg`,
  magnet: `${PACK}/effects/fx_magnet_field.svg`,
  zzz: `${PACK}/effects/fx_zzz.svg`,
};

export const UI = {
  battery: `${PACK}/ui/stat_battery.svg`,
  coin: `${PACK}/ui/coin_scrap.svg`,
  evo: `${PACK}/ui/evo_crystal.svg`,
  drag: `${PACK}/ui/gesture_drag.svg`,
};

// ---------------------------------------------------------------- 이미지 캐시

const cache: Map<string, HTMLImageElement> | null =
  typeof window !== "undefined" ? new Map() : null;
let readyCb: (() => void) | undefined;

/** 새 스프라이트가 로드될 때마다 호출(늦게 도착한 그림도 다음 프레임에 나타나게) */
export function setOnSpriteReady(cb: () => void) {
  readyCb = cb;
}

export function img(src: string): HTMLImageElement | null {
  if (!cache) return null;
  let im = cache.get(src);
  if (!im) {
    im = new Image();
    im.decoding = "async";
    im.onload = () => readyCb?.();
    im.src = src;
    cache.set(src, im);
  }
  return im;
}

/** 자주 쓰는 자산을 미리 데운다 */
export function preload(srcs: string[]) {
  srcs.forEach(img);
}

const ok = (im: HTMLImageElement | null): im is HTMLImageElement =>
  !!im && im.complete && im.naturalWidth > 0;

/**
 * (cx, cy) 중앙에 한 변 px 로 그린다. rot(라디안) 회전, alpha 곱연산.
 * 이미지가 준비 안 됐으면 아무것도 그리지 않고 false 를 돌려준다.
 */
export function drawImg(
  ctx: CanvasRenderingContext2D,
  src: string,
  cx: number,
  cy: number,
  px: number,
  rot = 0,
  alpha = 1,
): boolean {
  const im = img(src);
  if (!ok(im)) return false;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.translate(cx, cy);
  if (rot) ctx.rotate(rot);
  ctx.drawImage(im, -px / 2, -px / 2, px, px);
  ctx.restore();
  return true;
}
