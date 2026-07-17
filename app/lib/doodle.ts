export type Pt = [number, number];

/**
 * Hand-drawn line primitives for a canvas 2D context.
 *
 * Jitter is deterministic — the same (seed, index, phase) always yields the same
 * offset, so a shape keeps its silhouette across frames instead of vibrating.
 * Advancing the phase in discrete steps (see setPhase) is what makes the lines
 * "boil" like a doodle animation rather than shimmer like water.
 */
export function createDoodle(ctx: CanvasRenderingContext2D) {
  let phase = 0;

  const setPhase = (p: number) => {
    phase = p;
  };

  const wob = (seed: number, i: number, ph: number = phase) => {
    const v = Math.sin(seed * 127.1 + i * 311.7 + ph * 74.7) * 43758.5453;
    return (v - Math.floor(v)) * 2 - 1;
  };

  const wobblyPath = (pts: Pt[], seed: number, amp: number, close: boolean) => {
    const out: Pt[] = [];
    const n = pts.length;
    const segs = close ? n : n - 1;
    // Subdivide every edge, otherwise only the corners bend and the sides stay ruler-straight.
    for (let i = 0; i < segs; i++) {
      const [x1, y1] = pts[i];
      const [x2, y2] = pts[(i + 1) % n];
      for (let s = 0; s < 2; s++) {
        const f = s / 2;
        const k = i * 2 + s;
        out.push([
          x1 + (x2 - x1) * f + wob(seed, k) * amp,
          y1 + (y2 - y1) * f + wob(seed + 50, k) * amp,
        ]);
      }
    }
    if (!close) {
      const [lx, ly] = pts[n - 1];
      out.push([lx + wob(seed, segs * 2) * amp, ly + wob(seed + 50, segs * 2) * amp]);
    }
    ctx.beginPath();
    out.forEach(([px, py], i) => (i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py)));
    if (close) ctx.closePath();
  };

  const wobblyBlob = (x: number, y: number, r: number, seed: number, amp: number) => {
    const n = 12;
    const pts: Pt[] = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const rr = r + wob(seed, i) * amp;
      pts.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr]);
    }
    // Curve through the midpoints, using each vertex as a control point: consecutive
    // segments then share a tangent, so the outline closes without visible corners.
    const mid = (a: Pt, b: Pt): Pt => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    ctx.beginPath();
    let m = mid(pts[n - 1], pts[0]);
    ctx.moveTo(m[0], m[1]);
    for (let i = 0; i < n; i++) {
      m = mid(pts[i], pts[(i + 1) % n]);
      ctx.quadraticCurveTo(pts[i][0], pts[i][1], m[0], m[1]);
    }
    ctx.closePath();
  };

  const wobblyLine = (x1: number, y1: number, x2: number, y2: number, seed: number, amp: number) =>
    wobblyPath(
      [
        [x1, y1],
        [x2, y2],
      ],
      seed,
      amp,
      false,
    );

  const rectPts = (x: number, y: number, rw: number, rh: number): Pt[] => [
    [x, y],
    [x + rw, y],
    [x + rw, y + rh],
    [x, y + rh],
  ];

  const ngonPts = (n: number, r: number, rot = 0): Pt[] =>
    Array.from({ length: n }, (_, i) => {
      const a = rot + (i / n) * Math.PI * 2;
      return [Math.cos(a) * r, Math.sin(a) * r] as Pt;
    });

  const spikyPts = (n: number, rIn: number, rOut: number): Pt[] =>
    Array.from({ length: n * 2 }, (_, i) => {
      const a = -Math.PI / 2 + (i / (n * 2)) * Math.PI * 2;
      const r = i % 2 === 0 ? rOut : rIn;
      return [Math.cos(a) * r, Math.sin(a) * r] as Pt;
    });

  /** Pale wash inside, saturated line outside — reads as coloured pencil. */
  const fillStroke = (color: string, fillAlpha = 0.15) => {
    const ga = ctx.globalAlpha; // multiply, never assign: callers fade whole sprites via globalAlpha
    ctx.globalAlpha = ga * fillAlpha;
    ctx.fillStyle = color;
    ctx.fill();
    ctx.globalAlpha = ga;
    ctx.strokeStyle = color;
    ctx.stroke();
  };

  const strokeOnly = (color: string) => {
    ctx.strokeStyle = color;
    ctx.stroke();
  };

  return {
    setPhase,
    wob,
    wobblyPath,
    wobblyBlob,
    wobblyLine,
    rectPts,
    ngonPts,
    spikyPts,
    fillStroke,
    strokeOnly,
  };
}

export type Doodle = ReturnType<typeof createDoodle>;
