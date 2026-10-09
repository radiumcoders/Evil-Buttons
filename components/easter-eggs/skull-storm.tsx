"use client";

import confetti from "canvas-confetti";
import { useEffect } from "react";
import { findEgg } from "./eggs";
import { onEgg } from "./triggers";

const STORM_MS = 2600;
const Z_INDEX = 2147482800;

/** Spam the ConfettiButton and the party turns: a skull storm over the whole page. */
export function SkullStorm() {
  useEffect(() => {
    let interval: number | null = null;
    let timeout: number | null = null;
    const stop = () => {
      if (interval !== null) window.clearInterval(interval);
      if (timeout !== null) window.clearTimeout(timeout);
      interval = timeout = null;
    };

    const offEgg = onEgg("skulls", (point) => {
      if (interval !== null) return;
      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const shapes = ["💀", "🔥", "🖤"].map((text) => confetti.shapeFromText({ text, scalar: 3 }));
      const origin = point
        ? { x: point.x / window.innerWidth, y: point.y / window.innerHeight }
        : { x: 0.5, y: 0.6 };

      findEgg("skulls", { title: "Party's over.", note: "You had to keep clicking." });
      confetti({
        particleCount: reduceMotion ? 30 : 90,
        spread: 120,
        startVelocity: 55,
        origin,
        shapes,
        scalar: 3,
        ticks: 260,
        zIndex: Z_INDEX,
        disableForReducedMotion: false,
      });
      if (reduceMotion) return;
      // Then it rains skulls from the top for a while.
      interval = window.setInterval(() => {
        confetti({
          particleCount: 6,
          angle: 270,
          spread: 40,
          startVelocity: 8,
          gravity: 0.7,
          drift: (Math.random() - 0.5) * 1.5,
          origin: { x: Math.random(), y: -0.1 },
          shapes,
          scalar: 2.6,
          ticks: 420,
          flat: true,
          zIndex: Z_INDEX,
        });
      }, 90);
      timeout = window.setTimeout(stop, STORM_MS);
    });
    return () => {
      offEgg();
      stop();
    };
  }, []);
  return null;
}
