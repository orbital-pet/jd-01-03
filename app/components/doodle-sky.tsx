"use client";

import { useEffect, useRef } from "react";
import { createDoodle } from "../lib/doodle";
import {
  EAT_WORDS,
  JUNK_COLORS,
  OUCH_WORDS,
  type BgStar,
  type Debris,
  type JunkKind,
  type Popup,
  type Spark,
  burst,
  drawBackdrop,
  drawDebris,
  drawMascot,
  drawPopups,
  drawSparks,
  fitCanvas,
  makeDebris,
  makePopup,
  pickEdible,
  seedStars,
  stepDebris,
  stepSwallow,
  updatePopups,
  updateSparks,
} from "../lib/doodle-art";

/**
 * Attract mode for the landing page: the mascot plays itself in the bottom band,
 * chasing junk and dodging spikes. Move a cursor or finger over the page and it
 * comes to you instead — the page is a demo of the game, not a picture of it.
 */
export default function DoodleSky() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const d = createDoodle(ctx);

    let w = 0;
    let h = 0;
    let raf = 0;
    let last = performance.now();
    let t = 0;
    let spawnIn = 0.6;

    const hero = {
      x: 0,
      y: 0,
      r: 26,
      mouth: 0,
      blink: 2,
      blinkT: 0,
      hurt: 0,
      look: { x: 0, y: 1 },
    };
    const junks: Debris[] = [];
    const popups: Popup[] = [];
    const sparks: Spark[] = [];
    let stars: BgStar[] = [];

    // Where the pointer last was, and until when it outranks the mascot's own appetite.
    const lure = { x: 0, y: 0, until: -1 };

    // The mascot is penned into the bottom strip so it never wanders across the headline.
    const band = () => ({ lo: h * 0.7, hi: h - 56 });

    const spawn = () => {
      const roll = Math.random();
      const kind: JunkKind = roll < 0.08 ? "star" : roll < 0.2 ? "hazard" : pickEdible();
      const size = kind === "star" ? 15 : kind === "hazard" ? 16 + Math.random() * 6 : 13 + Math.random() * 6;
      junks.push(makeDebris(kind, w, size, 42 + Math.random() * 34));
    };

    const update = (dt: number) => {
      spawnIn -= dt;
      if (spawnIn <= 0) {
        spawn();
        spawnIn = 1.1 + Math.random() * 0.9;
      }

      const { lo, hi } = band();
      const clampY = (y: number) => Math.min(Math.max(y, lo), hi);

      hero.blink -= dt;
      if (hero.blink <= 0) {
        hero.blink = 2.2 + Math.random() * 2.5;
        hero.blinkT = 0.13;
      }
      hero.blinkT = Math.max(0, hero.blinkT - dt);
      hero.hurt = Math.max(0, hero.hurt - dt);

      let prey: Debris | null = null;
      let preyD = Infinity;
      let spike: Debris | null = null;
      let spikeD = Infinity;
      for (const j of junks) {
        if (j.eatT >= 0) continue;
        const dist = Math.hypot(j.x - hero.x, j.y - hero.y);
        if (j.kind === "hazard") {
          if (dist < spikeD) {
            spikeD = dist;
            spike = j;
          }
        } else if (j.y > h * 0.3 && dist < preyD) {
          preyD = dist;
          prey = j;
        }
      }

      let tx: number;
      let ty: number;
      if (t < lure.until) {
        tx = lure.x;
        ty = clampY(lure.y);
      } else if (prey) {
        tx = prey.x;
        ty = clampY(prey.y);
      } else {
        // nothing to chase — idle drift, so it never sits perfectly still
        tx = w / 2 + Math.sin(t * 0.5) * w * 0.14;
        ty = lo + 24 + Math.sin(t * 1.3) * 6;
      }
      if (spike && spikeD < 96) {
        tx += (hero.x - spike.x) * 1.4; // shy away from spikes without abandoning the chase
      }
      const k = Math.min(1, dt * 3.2);
      hero.x += (Math.min(Math.max(tx, hero.r + 8), w - hero.r - 8) - hero.x) * k;
      hero.y += (clampY(ty) - hero.y) * k;

      const wantOpen = prey && preyD < hero.r + 110 ? 1 : 0;
      hero.mouth += (wantOpen - hero.mouth) * Math.min(1, dt * 8);
      const gaze = prey ?? spike;
      if (gaze) {
        const dx = gaze.x - hero.x;
        const dy = gaze.y - hero.y;
        const dd = Math.hypot(dx, dy) || 1;
        hero.look.x += (dx / dd - hero.look.x) * Math.min(1, dt * 6);
        hero.look.y += (dy / dd - hero.look.y) * Math.min(1, dt * 6);
      }

      const mouthX = hero.x;
      const mouthY = hero.y + hero.r * 0.4;

      for (let i = junks.length - 1; i >= 0; i--) {
        const j = junks[i];
        if (j.eatT >= 0) {
          stepSwallow(j, dt, mouthX, mouthY);
          if (j.eatT >= 1) {
            junks.splice(i, 1);
            const word =
              j.kind === "star" ? "+40!" : EAT_WORDS[Math.floor(Math.random() * EAT_WORDS.length)];
            const color = j.kind === "star" ? JUNK_COLORS.star : "#ffffff";
            popups.push(makePopup(hero.x, hero.y - hero.r - 16, word, color, 24));
            burst(sparks, mouthX, mouthY, JUNK_COLORS[j.kind], 7);
            hero.r = Math.min(32, hero.r + 0.5);
          }
          continue;
        }
        stepDebris(j, dt);
        if (j.y > h + 70) {
          junks.splice(i, 1);
          continue;
        }

        const dist = Math.hypot(j.x - hero.x, j.y - hero.y);
        if (j.kind === "hazard") {
          if (hero.hurt <= 0 && dist < hero.r + j.size * 0.75) {
            junks.splice(i, 1);
            hero.hurt = 1.2;
            const word = OUCH_WORDS[Math.floor(Math.random() * OUCH_WORDS.length)];
            popups.push(makePopup(hero.x, hero.y - hero.r - 18, word, JUNK_COLORS.hazard, 26));
            burst(sparks, j.x, j.y, JUNK_COLORS.hazard, 10);
          }
        } else {
          if (dist < hero.r + 60) {
            const pull = Math.min(1, dt * 3);
            j.x0 += (hero.x - j.x) * pull;
            j.y += (hero.y - j.y) * pull;
          }
          if (dist < hero.r + j.size * 0.7 + hero.mouth * 10) j.eatT = 0;
        }
      }

      hero.r += (26 - hero.r) * Math.min(1, dt * 0.35); // digest back down to normal size
      updatePopups(popups, dt);
      updateSparks(sparks, dt);
    };

    const draw = () => {
      d.setPhase(Math.floor(t * 7));
      drawBackdrop(ctx, d, w, h, t, stars);
      for (const j of junks) drawDebris(ctx, d, j, t);

      ctx.save();
      if (hero.hurt > 0 && Math.floor(t * 16) % 2 === 0) ctx.globalAlpha = 0.4;
      drawMascot(ctx, d, {
        x: hero.x,
        y: hero.y,
        r: hero.r,
        t,
        mouth: hero.mouth,
        blinkT: hero.blinkT,
        lookX: hero.look.x,
        lookY: hero.look.y,
      });
      ctx.restore();

      drawSparks(ctx, sparks);
      drawPopups(ctx, d, popups);
    };

    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      t += dt;
      update(dt);
      draw();
      raf = requestAnimationFrame(loop);
    };

    // The canvas is pointer-events:none so the buttons stay clickable — listen on the window instead.
    const onMove = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      if (x < 0 || y < 0 || x > rect.width || y > rect.height) return;
      lure.x = x;
      lure.y = y - (e.pointerType === "touch" ? 60 : 0);
      lure.until = t + 2;
    };

    const resize = () => {
      ({ w, h } = fitCanvas(canvas, ctx));
      stars = seedStars(w, h, 46);
      if (!hero.x) {
        hero.x = w / 2;
        hero.y = band().lo + 24;
      }
    };

    resize();
    window.addEventListener("resize", resize);

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      // Still a doodle sky, just a still one.
      for (let i = 0; i < 5; i++) {
        const j = makeDebris(pickEdible(), w, 14 + i * 2, 0);
        j.y = h * (0.18 + i * 0.11);
        j.x = j.x0;
        junks.push(j);
      }
      draw();
      return () => window.removeEventListener("resize", resize);
    }

    window.addEventListener("pointermove", onMove);
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("pointermove", onMove);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 h-full w-full"
    />
  );
}
