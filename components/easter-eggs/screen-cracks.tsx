"use client";

import { useEffect, useState } from "react";
import { findEgg } from "./eggs";

/** Clicks, within STREAK_MS and STREAK_RADIUS px of each other, that count as a rage. */
const RAGE_CLICKS = 5;
const STREAK_MS = 1200;
const STREAK_RADIUS = 90;
const MAX_CRACKS = 8;
const SIZE = 420;

/** Clicks on anything you'd legitimately mash are left alone. */
const INTERACTIVE =
  "a, button, input, textarea, select, label, summary, canvas, video, [contenteditable], [role=button], [role=slider], [role=switch], [role=tab], [role=link], [role=menuitem], [role=option], [role=checkbox], [role=dialog], [role=alertdialog], [data-detonation]";

type Crack = { id: number; x: number; y: number; seed: number };

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Jagged radial cracks from the impact, joined by broken rings like struck glass. */
function crackPath(seed: number) {
  const random = mulberry32(seed);
  const spokes = 9 + Math.floor(random() * 6);
  const angles = Array.from(
    { length: spokes },
    (_, i) => ((i + random() * 0.6) / spokes) * Math.PI * 2,
  ).sort((a, b) => a - b);

  let d = "";
  // Where each spoke crosses each ring, so the rings can hop between spokes.
  const crossings: Array<Array<[number, number]>> = [[], []];
  const rings = [28 + random() * 18, 70 + random() * 30];

  for (const start of angles) {
    let angle = start;
    let radius = 4 + random() * 6;
    let x = Math.cos(angle) * radius;
    let y = Math.sin(angle) * radius;
    d += `M${x.toFixed(1)} ${y.toFixed(1)}`;
    const reach = 90 + random() * 120;
    const ringHits: Array<[number, number] | null> = [null, null];
    while (radius < reach) {
      radius += 12 + random() * 22;
      angle += (random() - 0.5) * 0.35;
      x = Math.cos(angle) * radius;
      y = Math.sin(angle) * radius;
      d += `L${x.toFixed(1)} ${y.toFixed(1)}`;
      rings.forEach((ring, i) => {
        if (!ringHits[i] && radius >= ring) ringHits[i] = [x, y];
      });
    }
    ringHits.forEach((hit, i) => crossings[i].push(hit ?? [Number.NaN, Number.NaN]));
  }

  for (const ring of crossings) {
    for (let i = 0; i < ring.length; i++) {
      const [ax, ay] = ring[i];
      const [bx, by] = ring[(i + 1) % ring.length];
      if (Number.isNaN(ax) || Number.isNaN(bx) || random() < 0.3) continue;
      // A kink in the middle keeps the ring from looking drawn with a compass.
      const mx = (ax + bx) / 2 + (random() - 0.5) * 10;
      const my = (ay + by) / 2 + (random() - 0.5) * 10;
      d += `M${ax.toFixed(1)} ${ay.toFixed(1)}L${mx.toFixed(1)} ${my.toFixed(1)}L${bx.toFixed(1)} ${by.toFixed(1)}`;
    }
  }
  return d;
}

function CrackMark({ crack, onDone }: { crack: Crack; onDone: () => void }) {
  const [d] = useState(() => crackPath(crack.seed));
  return (
    <svg
      className="screen-crack"
      width={SIZE}
      height={SIZE}
      viewBox={`${-SIZE / 2} ${-SIZE / 2} ${SIZE} ${SIZE}`}
      style={{ left: crack.x - SIZE / 2, top: crack.y - SIZE / 2 }}
      onAnimationEnd={onDone}
    >
      <circle r="9" fill="rgb(255 255 255 / 0.35)" />
      <path d={d} fill="none" stroke="rgb(0 0 0 / 0.45)" strokeWidth="2.6" strokeLinejoin="round" />
      <path d={d} fill="none" stroke="rgb(255 255 255 / 0.9)" strokeWidth="1" strokeLinejoin="round" />
    </svg>
  );
}

/** Rage-click empty space and the screen gives way. */
export function ScreenCracks() {
  const [cracks, setCracks] = useState<Crack[]>([]);

  useEffect(() => {
    let streak: Array<{ x: number; y: number; t: number }> = [];
    let nextId = 0;

    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0) return;
      const target = event.target as Element | null;
      if (target?.closest?.(INTERACTIVE)) return;

      const now = performance.now();
      const point = { x: event.clientX, y: event.clientY, t: now };
      streak = streak.filter(
        (click) =>
          now - click.t < STREAK_MS &&
          Math.hypot(click.x - point.x, click.y - point.y) < STREAK_RADIUS,
      );
      streak.push(point);
      if (streak.length < RAGE_CLICKS) return;

      if (streak.length === RAGE_CLICKS) {
        findEgg("cracks", { title: "Easy.", note: "That's a screen, not a button." });
      }
      if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        document.body.animate(
          [
            { transform: "translate(0, 0)" },
            { transform: "translate(-4px, 3px)" },
            { transform: "translate(3px, -2px)" },
            { transform: "translate(0, 0)" },
          ],
          { duration: 160 },
        );
      }
      const crack = { id: nextId++, x: point.x, y: point.y, seed: Math.floor(Math.random() * 1e9) };
      setCracks((current) => [...current, crack].slice(-MAX_CRACKS));
    };

    window.addEventListener("pointerdown", onPointerDown, { passive: true });
    return () => window.removeEventListener("pointerdown", onPointerDown);
  }, []);

  if (cracks.length === 0) return null;
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-[2147482300] overflow-hidden">
      {cracks.map((crack) => (
        <CrackMark
          key={crack.id}
          crack={crack}
          onDone={() => setCracks((current) => current.filter((c) => c.id !== crack.id))}
        />
      ))}
    </div>
  );
}
