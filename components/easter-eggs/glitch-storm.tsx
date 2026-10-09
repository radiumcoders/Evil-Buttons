"use client";

import { useEffect, useState } from "react";
import { findEgg } from "./eggs";
import { onEgg } from "./triggers";

const GLITCH_FOR = 2600;
const FRAME_MS = 70;
const COLORS = ["#ff2a3c", "#00f0ff", "#ffffff", "#ff00d4"];

type Bar = { top: number; height: number; shift: number; color: string };

function randomBars(): Bar[] {
  return Array.from({ length: 4 + Math.floor(Math.random() * 6) }, () => ({
    top: Math.random() * 100,
    height: 0.4 + Math.random() * 7,
    shift: (Math.random() - 0.5) * 18,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
  }));
}

/** Mash the GlitchButton and the glitch escapes into the whole page for a moment. */
export function GlitchStorm() {
  const [bars, setBars] = useState<Bar[] | null>(null);

  useEffect(() => {
    let interval: number | null = null;
    let timeout: number | null = null;
    const stop = () => {
      if (interval !== null) window.clearInterval(interval);
      if (timeout !== null) window.clearTimeout(timeout);
      interval = timeout = null;
      document.documentElement.removeAttribute("data-glitch");
      setBars(null);
    };

    const offEgg = onEgg("glitch", () => {
      if (interval !== null) return;
      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      document.documentElement.setAttribute("data-glitch", "");
      setBars(randomBars());
      if (!reduceMotion) interval = window.setInterval(() => setBars(randomBars()), FRAME_MS);
      timeout = window.setTimeout(() => {
        stop();
        findEgg("glitch", { title: "Corrupted.", note: "The glitch got out of its button." });
      }, reduceMotion ? 700 : GLITCH_FOR);
    });
    return () => {
      offEgg();
      stop();
    };
  }, []);

  if (!bars) return null;
  return (
    <div aria-hidden className="glitch-storm">
      {bars.map((bar, index) => (
        <span
          key={index}
          style={{
            top: `${bar.top}%`,
            height: `${bar.height}%`,
            background: bar.color,
            transform: `translateX(${bar.shift}%)`,
          }}
        />
      ))}
      <p className="glitch-storm-label font-pixel-display">SIGNAL CORRUPTED</p>
    </div>
  );
}
