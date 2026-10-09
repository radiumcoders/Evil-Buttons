"use client";

import { useRef, useState } from "react";
import { findEgg } from "./eggs";
import { useKeySequence } from "./use-key-sequence";

const KONAMI = [
  "ArrowUp",
  "ArrowUp",
  "ArrowDown",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "ArrowLeft",
  "ArrowRight",
  "b",
  "a",
] as const;

/** ↑ ↑ ↓ ↓ ← → ← → B A: the site goes to hell (styles live under `html[data-hell]`). */
export function HellMode() {
  const [on, setOn] = useState(false);
  // Hell is dark: light mode only goes parchment under the filter. The theme
  // is switched without saving it, and put back on the way out.
  const wasLightRef = useRef(false);

  useKeySequence(KONAMI, () => {
    const html = document.documentElement;
    const next = !html.hasAttribute("data-hell");
    if (next) {
      wasLightRef.current = !html.classList.contains("dark");
      html.classList.add("dark");
    } else if (wasLightRef.current) {
      html.classList.remove("dark");
    }
    html.toggleAttribute("data-hell", next);
    setOn(next);
    if (next) {
      findEgg("hell", {
        title: "Welcome to hell mode.",
        note: "Enter the code again to escape.",
      });
    }
  });

  return on ? <div aria-hidden className="hell-vignette" /> : null;
}
