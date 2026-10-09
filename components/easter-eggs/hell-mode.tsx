"use client";

import { useEffect, useState } from "react";
import { findEgg } from "./eggs";
import { onEgg } from "./triggers";

const HELL_FOR = 12_000;

/** The demon gets out: the site goes to hell for a while (styles live under `html[data-hell]`). */
export function HellMode() {
  const [on, setOn] = useState(false);

  useEffect(() => {
    const html = document.documentElement;
    let timeout: number | null = null;
    // Hell is dark: light mode only goes parchment under the filter. The theme
    // is switched without saving it, and put back on the way out.
    let wasLight = false;

    const leave = () => {
      if (timeout !== null) window.clearTimeout(timeout);
      timeout = null;
      if (!html.hasAttribute("data-hell")) return;
      if (wasLight) html.classList.remove("dark");
      html.removeAttribute("data-hell");
      setOn(false);
    };

    const offEgg = onEgg("hell", () => {
      if (!html.hasAttribute("data-hell")) {
        wasLight = !html.classList.contains("dark");
        html.classList.add("dark");
        html.setAttribute("data-hell", "");
        setOn(true);
      }
      // Summoning again keeps the gates open longer.
      if (timeout !== null) window.clearTimeout(timeout);
      timeout = window.setTimeout(leave, HELL_FOR);
      findEgg("hell", { title: "You let it out.", note: "Hell mode for 12 seconds. Esc if you can't take it." });
    });

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") leave();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      offEgg();
      window.removeEventListener("keydown", onKeyDown);
      leave();
    };
  }, []);

  return on ? <div aria-hidden className="hell-vignette" /> : null;
}
