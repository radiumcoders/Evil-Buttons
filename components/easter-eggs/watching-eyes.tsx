"use client";

import { useEffect, useState } from "react";
import { findEgg } from "./eggs";

/** How long the page must sit untouched before something notices. */
const IDLE_AFTER = 30_000;
const PAIRS = 4;

type Point = { x: number; y: number };

type Pair = Point & {
  size: number;
  delay: number;
  blink: number;
  /** Pupil offset in viewBox units, toward where the pointer was last seen. */
  look: Point;
};

/** Places pairs along the edges, away from whatever was being read in the middle. */
function placePairs(width: number, height: number, pointer: Point): Pair[] {
  const pairs: Pair[] = [];
  for (let i = 0; i < PAIRS; i++) {
    const side = i % 4;
    const along = 0.15 + Math.random() * 0.7;
    const inset = 0.05 + Math.random() * 0.1;
    const x = side === 0 ? inset : side === 1 ? 1 - inset : along;
    const y = side === 2 ? inset : side === 3 ? 1 - inset : along;
    const dx = pointer.x - x * width;
    const dy = pointer.y - y * height;
    const distance = Math.hypot(dx, dy) || 1;
    pairs.push({
      x: x * width,
      y: y * height,
      look: { x: (dx / distance) * 1.8, y: (dy / distance) * 1.2 },
      size: 14 + Math.random() * 12,
      delay: 0.6 + i * 1.1 + Math.random() * 0.6,
      blink: 3.5 + Math.random() * 3,
    });
  }
  return pairs;
}

/** Leave the page alone for a minute and red eyes open in the dark around it. */
export function WatchingEyes() {
  const [pairs, setPairs] = useState<Pair[] | null>(null);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    let lastActive = performance.now();
    let showing = false;
    let leaveTimeout: number | null = null;
    let pointer = { x: window.innerWidth / 2, y: window.innerHeight / 2 };

    const onActivity = (event: Event) => {
      lastActive = performance.now();
      if (event instanceof PointerEvent) {
        pointer = { x: event.clientX, y: event.clientY };
      }
      if (!showing || leaveTimeout !== null) return;
      // Caught: they blink shut and slip away.
      setLeaving(true);
      leaveTimeout = window.setTimeout(() => {
        leaveTimeout = null;
        showing = false;
        setPairs(null);
        setLeaving(false);
        findEgg("eyes", { title: "Something was watching you.", note: "It still is." });
      }, 260);
    };

    const check = window.setInterval(() => {
      if (showing || document.hidden) return;
      if (performance.now() - lastActive < IDLE_AFTER) return;
      // Don't pile onto another egg (the burnt page, the flashlight) that already owns the screen.
      if (document.querySelector(".lights-out, [data-detonation]")) return;
      showing = true;
      setPairs(placePairs(window.innerWidth, window.innerHeight, pointer));
    }, 2000);

    const events = ["pointermove", "pointerdown", "keydown", "wheel", "touchstart"] as const;
    for (const name of events) {
      window.addEventListener(name, onActivity, { passive: true, capture: true });
    }
    window.addEventListener("scroll", onActivity, { passive: true, capture: true });
    return () => {
      window.clearInterval(check);
      if (leaveTimeout !== null) window.clearTimeout(leaveTimeout);
      for (const name of events) {
        window.removeEventListener(name, onActivity, { capture: true });
      }
      window.removeEventListener("scroll", onActivity, { capture: true });
    };
  }, []);

  if (!pairs) return null;
  return (
    <div aria-hidden data-leaving={leaving || undefined} className="watching-eyes">
      {pairs.map((pair, index) => (
          <svg
            key={index}
            className="watching-eyes-pair"
            width={pair.size * 3.4}
            height={pair.size * 1.4}
            viewBox="-17 -7 34 14"
            style={{
              left: pair.x,
              top: pair.y,
              animationDelay: `${pair.delay}s`,
            }}
          >
            <g
              className="watching-eyes-lids"
              style={{ animationDuration: `${pair.blink}s`, animationDelay: `${pair.delay + 1}s` }}
            >
              {[-8, 8].map((cx) => (
                <g key={cx} transform={`translate(${cx} 0)`}>
                  <path d="M-6.5 0 Q0 -6 6.5 0 Q0 6 -6.5 0Z" fill="#2a0303" />
                  <circle cx={pair.look.x} cy={pair.look.y} r="3.4" fill="#ff2a14" />
                  <ellipse cx={pair.look.x} cy={pair.look.y} rx="0.9" ry="2.8" fill="#0a0000" />
                </g>
              ))}
            </g>
          </svg>
      ))}
    </div>
  );
}
