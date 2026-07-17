import type { Doodle } from "./doodle";

export const SPACE_BG = "#141838";
export const DOODLE_FONT = '"Gaegu", "Comic Sans MS", "Chalkboard SE", cursive';
export const BEST_KEY = "sjs-best";

export const MASCOT = {
  body: "#7ee8b2",
  ink: "#0f2e22",
  eye: "#f4fff9",
  blush: "#ff8fab",
  antenna: "#ffd166",
};

export type JunkKind = "satellite" | "bolt" | "can" | "spring" | "star" | "hazard";

export const JUNK_COLORS: Record<JunkKind, string> = {
  satellite: "#8ecbff",
  bolt: "#cfd8e6",
  can: "#f9a8d4",
  spring: "#c4b5fd",
  star: "#ffd166",
  hazard: "#ff8080",
};

export const EDIBLE_KINDS = ["satellite", "bolt", "can", "spring"] as const;

export const EAT_WORDS = ["냠!", "쩝쩝", "꿀꺽!", "냠냠", "암냠!"];
export const OUCH_WORDS = ["아야!", "으악!", "따가워!"];

export const pickEdible = (): JunkKind =>
  EDIBLE_KINDS[Math.floor(Math.random() * EDIBLE_KINDS.length)];

// ---------------------------------------------------------------- backdrop

export type BgStar = { x: number; y: number; r: number; cross: boolean; seed: number; alpha: number };

export const seedStars = (w: number, h: number, n: number): BgStar[] =>
  Array.from({ length: n }, () => ({
    x: Math.random() * w,
    y: Math.random() * h,
    r: Math.random() * 1.6 + 0.6,
    cross: Math.random() < 0.28,
    seed: Math.random() * 10,
    alpha: 0.25 + Math.random() * 0.45,
  }));

export function drawBackdrop(
  ctx: CanvasRenderingContext2D,
  d: Doodle,
  w: number,
  h: number,
  t: number,
  stars: BgStar[],
) {
  // Overdraw the edges so a screen shake never exposes bare canvas.
  ctx.fillStyle = SPACE_BG;
  ctx.fillRect(-12, -12, w + 24, h + 24);

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

  ctx.lineWidth = 1.5;
  for (const s of stars) {
    ctx.globalAlpha = s.alpha * (0.7 + 0.3 * Math.sin(t * 1.5 + s.seed));
    if (s.cross) {
      const l = s.r * 3;
      ctx.strokeStyle = "#fff7d6";
      ctx.beginPath();
      ctx.moveTo(s.x - l, s.y);
      ctx.lineTo(s.x + l, s.y);
      ctx.moveTo(s.x, s.y - l);
      ctx.lineTo(s.x, s.y + l);
      ctx.stroke();
    } else {
      ctx.fillStyle = "#fff7d6";
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;

  // sleeping moon
  const mx = w * 0.85;
  const my = h * 0.14;
  ctx.lineWidth = 3;
  d.wobblyBlob(mx, my, 26, 5.5, 1.8);
  d.fillStroke("#ffe9a8", 0.12);
  ctx.strokeStyle = "#ffe9a8";
  ctx.lineWidth = 2.5;
  for (const dir of [-1, 1] as const) {
    ctx.beginPath();
    ctx.arc(mx + dir * 8, my - 2, 4, Math.PI * 0.15, Math.PI * 0.85);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.arc(mx, my + 9, 2.5, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 0.5 + 0.5 * Math.sin(t * 2);
  ctx.font = `700 15px ${DOODLE_FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#ffe9a8";
  ctx.fillText("z", mx + 26, my - 24);
  ctx.fillText("z", mx + 35, my - 34);
  ctx.globalAlpha = 1;
}

// ---------------------------------------------------------------- debris

export type Debris = {
  kind: JunkKind;
  x0: number; // sway centre — move THIS to relocate a piece, never x (x is recomputed each step)
  x: number;
  y: number;
  vy: number;
  swayAmp: number;
  swayT: number;
  swaySpeed: number;
  rot: number;
  vrot: number;
  size: number;
  seed: number;
  eatT: number; // -1 = drifting, 0..1 = being swallowed
};

export function makeDebris(kind: JunkKind, w: number, size: number, vy: number): Debris {
  const x0 = 34 + Math.random() * Math.max(40, w - 68);
  return {
    kind,
    x0,
    x: x0,
    y: -60,
    vy,
    swayAmp: 10 + Math.random() * 24,
    swayT: Math.random() * Math.PI * 2,
    swaySpeed: 0.8 + Math.random() * 1.4,
    rot: Math.random() * Math.PI * 2,
    vrot: (Math.random() - 0.5) * 1.6,
    size,
    seed: Math.random() * 100,
    eatT: -1,
  };
}

export function stepDebris(j: Debris, dt: number) {
  j.swayT += j.swaySpeed * dt;
  j.x = j.x0 + Math.sin(j.swayT) * j.swayAmp;
  j.y += j.vy * dt;
  j.rot += j.vrot * dt;
}

/** Sucked toward the mouth while spinning up and shrinking away. */
export function stepSwallow(j: Debris, dt: number, mouthX: number, mouthY: number) {
  j.eatT += dt / 0.16;
  const k = Math.min(1, dt * 20);
  j.x += (mouthX - j.x) * k;
  j.y += (mouthY - j.y) * k;
  j.rot += j.vrot * 6 * dt;
}

export function drawDebris(ctx: CanvasRenderingContext2D, d: Doodle, j: Debris, t: number) {
  ctx.save();
  ctx.translate(j.x, j.y);
  ctx.rotate(j.rot);
  const sc = j.eatT >= 0 ? Math.max(0.05, 1 - j.eatT) : 1;
  ctx.scale(sc, sc);
  drawJunkShape(ctx, d, j.kind, j.size, j.seed, t);
  ctx.restore();
}

/** Draws one piece of junk centred on the current origin. Caller owns the transform. */
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
      for (const dir of [-1, 1] as const) {
        const px = dir === 1 ? s * 0.85 : -s * 1.95;
        d.wobblyPath(d.rectPts(px, -s * 0.38, s * 1.1, s * 0.76), seed + dir, 1.5, true);
        d.fillStroke("#ffd166", 0.13);
        d.wobblyLine(px + s * 0.55, -s * 0.38, px + s * 0.55, s * 0.38, seed + 3 + dir, 1.1);
        d.strokeOnly("#ffd166");
      }
      d.wobblyPath(d.rectPts(-s * 0.75, -s * 0.55, s * 1.5, s * 1.1), seed + 7, 1.6, true);
      d.fillStroke(c);
      d.wobblyLine(0, -s * 0.55, 0, -s * 1.05, seed + 8, 1);
      d.strokeOnly(c);
      ctx.beginPath();
      ctx.arc(0, -s * 1.15, 2.6, 0, Math.PI * 2);
      d.strokeOnly(c);
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
      d.wobblyPath(d.ngonPts(6, s, seed), seed, 1.6, true);
      d.fillStroke(c);
      d.wobblyBlob(0, 0, s * 0.42, seed + 9, 1.1);
      d.strokeOnly(c);
      break;
    }
    case "can": {
      d.wobblyPath(d.rectPts(-s * 0.55, -s * 0.8, s * 1.1, s * 1.6), seed, 1.6, true);
      d.fillStroke(c);
      d.wobblyLine(-s * 0.55, -s * 0.42, s * 0.55, -s * 0.42, seed + 2, 1.1);
      d.strokeOnly(c);
      d.wobblyLine(-s * 0.55, s * 0.4, s * 0.55, s * 0.4, seed + 3, 1.1);
      d.strokeOnly(c);
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
      d.wobblyLine(-s * 0.14, s * 0.18, s * 0.14, s * 0.18, seed + 6, 0.7);
      ctx.stroke();
      break;
    }
    case "spring": {
      const pts: [number, number][] = [[-s * 0.3, -s * 0.85]];
      for (let i = 0; i < 6; i++) {
        pts.push([(i % 2 === 0 ? 1 : -1) * s * 0.45, -s * 0.65 + (i / 5) * s * 1.3]);
      }
      pts.push([s * 0.3, s * 0.85]);
      d.wobblyPath(pts, seed, 1.3, false);
      d.strokeOnly(c);
      break;
    }
    case "star": {
      const pulse = 1 + Math.sin(t * 5 + seed) * 0.08;
      d.wobblyPath(d.spikyPts(5, s * 0.45 * pulse, s * pulse), seed, 1.2, true);
      d.fillStroke(c, 0.25);
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
      const rOut = s * (1.5 + Math.sin(t * 6 + seed) * 0.12);
      d.wobblyPath(d.spikyPts(9, s, rOut), seed, 1.4, true);
      d.fillStroke(c, 0.18);
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = c;
      for (const dir of [-1, 1] as const) {
        ctx.beginPath();
        ctx.moveTo(dir * s * 0.45, -s * 0.32);
        ctx.lineTo(dir * s * 0.12, -s * 0.14);
        ctx.stroke();
      }
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

// ---------------------------------------------------------------- mascot

export type MascotPose = {
  x: number;
  y: number;
  r: number;
  t: number;
  mouth: number; // 0 = closed smile, 1 = wide open
  blinkT: number; // > 0 while the eyes are shut
  lookX: number; // unit vector toward whatever it is eyeing
  lookY: number;
};

export function drawMascot(ctx: CanvasRenderingContext2D, d: Doodle, p: MascotPose) {
  const { x, y, r, t } = p;
  ctx.save();
  ctx.lineWidth = 4;

  const bobY = Math.sin(t * 3 + 1) * 2.5;
  const ax = x + Math.sin(t * 2) * 3;
  d.wobblyLine(x, y - r + 4, ax, y - r - 15 + bobY, 31, 1.3);
  d.strokeOnly(MASCOT.body);
  ctx.beginPath();
  ctx.arc(ax, y - r - 18 + bobY, 3.4, 0, Math.PI * 2);
  ctx.fillStyle = MASCOT.antenna;
  ctx.fill();
  ctx.lineWidth = 2.5;
  d.strokeOnly(MASCOT.body);
  ctx.lineWidth = 4;

  d.wobblyBlob(x, y, r, 7.7, r * 0.06);
  d.fillStroke(MASCOT.body, 0.34);

  const er = r * 0.2;
  for (const dir of [-1, 1] as const) {
    const cx = x + dir * r * 0.34;
    const cy = y - r * 0.3;
    if (p.blinkT > 0) {
      ctx.beginPath();
      ctx.arc(cx, cy + 1, er * 0.7, Math.PI * 0.15, Math.PI * 0.85);
      ctx.strokeStyle = MASCOT.ink;
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.lineWidth = 4;
    } else {
      ctx.beginPath();
      ctx.ellipse(cx, cy, er * 0.78, er, 0, 0, Math.PI * 2);
      ctx.fillStyle = MASCOT.eye;
      ctx.fill();
      ctx.strokeStyle = MASCOT.ink;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(cx + p.lookX * er * 0.32, cy + p.lookY * er * 0.35, er * 0.42, 0, Math.PI * 2);
      ctx.fillStyle = MASCOT.ink;
      ctx.fill();
    }
  }

  const ga = ctx.globalAlpha;
  ctx.globalAlpha = ga * 0.4;
  ctx.fillStyle = MASCOT.blush;
  for (const dir of [-1, 1] as const) {
    ctx.beginPath();
    ctx.ellipse(x + dir * r * 0.62, y - r * 0.02, r * 0.15, r * 0.1, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = ga;

  const m = p.mouth;
  const my = y + r * 0.42;
  if (m > 0.15) {
    const mrx = r * (0.2 + 0.35 * m);
    const mry = r * (0.1 + 0.42 * m);
    // wobblyBlob only draws circles — squash the coordinate system to get an oval.
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
    ctx.beginPath();
    ctx.ellipse(x, my + mry * 0.4, mrx * 0.5, mry * 0.32, 0, 0, Math.PI * 2);
    ctx.fillStyle = MASCOT.blush;
    ctx.fill();
  } else {
    ctx.beginPath();
    ctx.arc(x, my - r * 0.08, r * 0.24, Math.PI * 0.2, Math.PI * 0.8);
    ctx.strokeStyle = MASCOT.ink;
    ctx.lineWidth = 3;
    ctx.stroke();
  }
  ctx.restore();
}

// ---------------------------------------------------------------- popups & sparks

export type Popup = {
  x: number;
  y: number;
  text: string;
  age: number;
  life: number;
  color: string;
  size: number;
  seed: number;
};

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

export function updatePopups(popups: Popup[], dt: number) {
  for (let i = popups.length - 1; i >= 0; i--) {
    const p = popups[i];
    p.age += dt;
    p.y -= 34 * dt;
    if (p.age >= p.life) popups.splice(i, 1);
  }
}

export function drawPopups(ctx: CanvasRenderingContext2D, d: Doodle, popups: Popup[]) {
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (const p of popups) {
    const f = p.age / p.life;
    ctx.save();
    ctx.globalAlpha = f < 0.7 ? 1 : 1 - (f - 0.7) / 0.3; // hold, then fade — it has to be readable first
    ctx.translate(p.x, p.y);
    ctx.rotate(d.wob(p.seed, 1) * 0.1);
    ctx.font = `700 ${p.size}px ${DOODLE_FONT}`;
    ctx.lineWidth = 5;
    ctx.strokeStyle = SPACE_BG;
    ctx.strokeText(p.text, 0, 0);
    ctx.fillStyle = p.color;
    ctx.fillText(p.text, 0, 0);
    ctx.restore();
  }
}

export type Spark = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  life: number;
  color: string;
  r: number;
};

export function burst(sparks: Spark[], x: number, y: number, color: string, n: number) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = 40 + Math.random() * 120;
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

export function updateSparks(sparks: Spark[], dt: number) {
  for (let i = sparks.length - 1; i >= 0; i--) {
    const s = sparks[i];
    s.age += dt;
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    if (s.age >= s.life) sparks.splice(i, 1);
  }
}

export function drawSparks(ctx: CanvasRenderingContext2D, sparks: Spark[]) {
  for (const s of sparks) {
    ctx.globalAlpha = Math.max(0, 1 - s.age / s.life);
    ctx.fillStyle = s.color;
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

// ---------------------------------------------------------------- canvas sizing

/** Sizes the backing buffer for the display's pixel density and returns CSS dimensions. */
export function fitCanvas(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2); // 3x buffers cost 9x fill for no visible gain
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  return { w, h };
}
