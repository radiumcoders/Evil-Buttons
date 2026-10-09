"use client";

import { useEffect, useRef, useState } from "react";
import { findEgg } from "./eggs";
import { onEgg } from "./triggers";

const PAIRS = 6;
const WATCH_FOR = 7000;

type Pair = { x: number; y: number; size: number; delay: number; blink: number };

/** Places pairs along the edges, away from whatever was being read in the middle. */
function placePairs(width: number, height: number): Pair[] {
  const pairs: Pair[] = [];
  for (let i = 0; i < PAIRS; i++) {
    const side = i % 4;
    const along = 0.12 + Math.random() * 0.76;
    const inset = 0.05 + Math.random() * 0.1;
    const x = side === 0 ? inset : side === 1 ? 1 - inset : along;
    const y = side === 2 ? inset : side === 3 ? 1 - inset : along;
    pairs.push({
      x: x * width,
      y: y * height,
      size: 14 + Math.random() * 12,
      delay: 0.15 + i * 0.35 + Math.random() * 0.3,
      blink: 3.5 + Math.random() * 3,
    });
  }
  return pairs;
}

/** Stare into the EvilEyeButton long enough and eyes open all around the page, following you. */
export function WatchingEyes() {
  const [pairs, setPairs] = useState<Pair[] | null>(null);
  const [leaving, setLeaving] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(
    () =>
      onEgg("eyes", () => {
        setLeaving(false);
        setPairs((current) => current ?? placePairs(window.innerWidth, window.innerHeight));
      }),
    [],
  );

  useEffect(() => {
    if (!pairs) return;
    findEgg("eyes", { title: "It stared back.", note: "They all did." });

    // Pupils track the pointer directly, without re-rendering.
    const look = (x: number, y: number) => {
      rootRef.current?.querySelectorAll<SVGGElement>("[data-pupil]").forEach((pupil) => {
        const pair = pairs[Number(pupil.dataset.pupil)];
        const dx = x - pair.x;
        const dy = y - pair.y;
        const distance = Math.hypot(dx, dy) || 1;
        pupil.setAttribute(
          "transform",
          `translate(${((dx / distance) * 1.8).toFixed(2)} ${((dy / distance) * 1.2).toFixed(2)})`,
        );
      });
    };
    const onPointerMove = (event: PointerEvent) => look(event.clientX, event.clientY);
    look(window.innerWidth / 2, window.innerHeight / 2);

    let gone: number | null = null;
    const leave = () => {
      if (gone !== null) return;
      setLeaving(true);
      gone = window.setTimeout(() => setPairs(null), 300);
    };
    const timeout = window.setTimeout(leave, WATCH_FOR);
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("pointerdown", leave, { passive: true });
    return () => {
      window.clearTimeout(timeout);
      if (gone !== null) window.clearTimeout(gone);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerdown", leave);
    };
  }, [pairs]);

  if (!pairs) return null;
  return (
    <div ref={rootRef} aria-hidden data-leaving={leaving || undefined} className="watching-eyes">
      {pairs.map((pair, index) => (
        <svg
          key={index}
          className="watching-eyes-pair"
          width={pair.size * 3.4}
          height={pair.size * 1.4}
          viewBox="-17 -7 34 14"
          style={{ left: pair.x, top: pair.y, animationDelay: `${pair.delay}s` }}
        >
          <g
            className="watching-eyes-lids"
            style={{ animationDuration: `${pair.blink}s`, animationDelay: `${pair.delay + 1}s` }}
          >
            {[-8, 8].map((cx) => (
              <g key={cx} transform={`translate(${cx} 0)`}>
                <path d="M-6.5 0 Q0 -6 6.5 0 Q0 6 -6.5 0Z" fill="#2a0303" />
                <g data-pupil={index}>
                  <circle r="3.4" fill="#ff2a14" />
                  <ellipse rx="0.9" ry="2.8" fill="#0a0000" />
                </g>
              </g>
            ))}
          </g>
        </svg>
      ))}
    </div>
  );
}
