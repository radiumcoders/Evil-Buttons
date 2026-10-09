"use client";

import { useEffect } from "react";
import { showEggToast } from "./egg-toast";
import { EASTER_EGGS, eggProgress } from "./eggs";

const TEASED_KEY = "evilbuttons:teased";
const TEASE_AFTER = 12_000;

/** Once per browser, a first-time visitor gets told the hunt exists. */
export function EggTeaser() {
  useEffect(() => {
    try {
      if (localStorage.getItem(TEASED_KEY)) return;
    } catch {
      return;
    }
    const timeout = window.setTimeout(() => {
      if (document.hidden || eggProgress().found > 0) return;
      try {
        localStorage.setItem(TEASED_KEY, "1");
      } catch {}
      showEggToast({
        title: `Psst. ${EASTER_EGGS.length} of these buttons hide easter eggs.`,
        note: "Play rough with them.",
        next: "Click for clues.",
      });
    }, TEASE_AFTER);
    return () => window.clearTimeout(timeout);
  }, []);
  return null;
}
