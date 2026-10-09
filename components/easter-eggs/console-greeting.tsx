"use client";

import { useEffect } from "react";
import { EASTER_EGGS } from "./eggs";

let greeted = false;

/** For whoever opens devtools: a hello, and a nudge toward the first egg. */
export function ConsoleGreeting() {
  useEffect(() => {
    if (greeted) return;
    greeted = true;
    console.log(
      "%c EVIL BUTTONS %c\n\nOpening the console? Bold.\n%d easter eggs are hidden on this site. Start with ↑ ↑ ↓ ↓ ← → ← → B A.",
      "background:#e5262d;color:#fff;font:700 14px/2 monospace;padding:2px 6px;border-radius:4px",
      "color:inherit;font:12px/1.6 monospace",
      EASTER_EGGS.length,
    );
  }, []);
  return null;
}
