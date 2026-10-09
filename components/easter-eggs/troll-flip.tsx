"use client";

import { useEffect } from "react";
import { findEgg } from "./eggs";
import { onEgg } from "./triggers";

const FLIPPED_FOR = 6000;
const TURN_MS = 900;

/** Catch the TrollButton and it gets its revenge: the page turns upside down for a bit. */
export function TrollFlip() {
  useEffect(() => {
    const html = document.documentElement;
    const timers: number[] = [];
    const clear = () => timers.splice(0).forEach((id) => window.clearTimeout(id));

    const flipBack = () => {
      if (!html.hasAttribute("data-flipped")) return;
      clear();
      html.removeAttribute("data-flipped");
      timers.push(window.setTimeout(() => html.removeAttribute("data-flip-turning"), TURN_MS));
    };

    const offEgg = onEgg("flip", () => {
      if (html.hasAttribute("data-flipped")) return;
      clear();
      // Turn the transition on first so the flip animates instead of snapping.
      html.setAttribute("data-flip-turning", "");
      requestAnimationFrame(() => html.setAttribute("data-flipped", ""));
      timers.push(window.setTimeout(flipBack, FLIPPED_FOR));
      findEgg("flip", { title: "Gotcha.", note: "Now you're the one being trolled." });
    });

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") flipBack();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      offEgg();
      clear();
      window.removeEventListener("keydown", onKeyDown);
      html.removeAttribute("data-flipped");
      html.removeAttribute("data-flip-turning");
    };
  }, []);
  return null;
}
