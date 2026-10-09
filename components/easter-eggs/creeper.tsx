"use client";

import { useEffect, useState } from "react";
import { findEgg } from "./eggs";
import { type EggPoint, onEgg } from "./triggers";

const HISS_MS = 1700;
/** Pixel sizes the page passes through after the blast, coarse to sharp. */
const PIXEL_STEPS = [28, 22, 16, 12, 8, 5, 3];
const PIXEL_STEP_MS = 230;

// The classic face on an 8x8 grid: 1 is a dark pixel.
const FACE = [
  "00000000",
  "01100110",
  "01100110",
  "00011000",
  "00111100",
  "00111100",
  "00100100",
  "00000000",
];
const GREENS = ["#4fa83d", "#5dbb46", "#3f8f31", "#6cc957", "#479a38"];

function CreeperFace() {
  return (
    <svg viewBox="0 0 8 8" className="size-full" shapeRendering="crispEdges">
      {FACE.flatMap((row, y) =>
        [...row].map((cell, x) => (
          <rect
            key={`${x}-${y}`}
            x={x}
            y={y}
            width="1"
            height="1"
            fill={cell === "1" ? "#0c160a" : GREENS[(x * 7 + y * 3) % GREENS.length]}
          />
        )),
      )}
    </svg>
  );
}

type State = { phase: "hiss"; at: EggPoint } | { phase: "pixels"; size: number } | null;

/** Break the MinecraftButton and a creeper was waiting behind it. */
export function Creeper() {
  const [state, setState] = useState<State>(null);

  useEffect(() => {
    const timers: number[] = [];
    const clear = () => timers.splice(0).forEach((id) => window.clearTimeout(id));

    const offEgg = onEgg("creeper", (point) => {
      clear();
      const at = point ?? { x: window.innerWidth / 2, y: window.innerHeight / 2 };
      setState({ phase: "hiss", at });
      timers.push(
        window.setTimeout(() => {
          const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
          if (!reduceMotion) {
            document.body.animate(
              [
                { transform: "translate(0, 0)" },
                { transform: "translate(-14px, 9px)" },
                { transform: "translate(11px, -8px)" },
                { transform: "translate(-6px, 4px)" },
                { transform: "translate(0, 0)" },
              ],
              { duration: 450 },
            );
          }
          // The blast leaves the page in blocks, which slowly sharpen back up.
          const steps = reduceMotion ? [] : PIXEL_STEPS;
          steps.forEach((size, index) => {
            timers.push(window.setTimeout(() => setState({ phase: "pixels", size }), index * PIXEL_STEP_MS));
          });
          timers.push(window.setTimeout(() => setState(null), steps.length * PIXEL_STEP_MS));
          findEgg("creeper", { title: "Ssssss… BOOM.", note: "Aw man." });
        }, HISS_MS),
      );
    });
    return () => {
      offEgg();
      clear();
    };
  }, []);

  useEffect(() => {
    if (state?.phase !== "pixels") return;
    document.body.style.filter = "url(#egg-pixelate)";
    return () => {
      document.body.style.filter = "";
    };
  }, [state?.phase]);

  if (!state) return null;
  if (state.phase === "pixels") {
    const half = state.size / 2;
    return (
      <>
        <svg aria-hidden className="pointer-events-none fixed size-0">
          <filter id="egg-pixelate" x="0" y="0" width="100%" height="100%">
            <feFlood x={half} y={half} width="1" height="1" />
            <feComposite width={state.size} height={state.size} />
            <feTile result="tiles" />
            <feComposite in="SourceGraphic" in2="tiles" operator="in" />
            <feMorphology operator="dilate" radius={half} />
          </filter>
        </svg>
        <div aria-hidden className="creeper-flash" />
      </>
    );
  }
  return (
    <div aria-hidden className="creeper" style={{ left: state.at.x, top: state.at.y }}>
      <div className="creeper-face">
        <CreeperFace />
      </div>
      <p className="creeper-hiss font-pixel-display">sssssss…</p>
    </div>
  );
}
