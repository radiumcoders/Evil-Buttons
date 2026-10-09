"use client";

import { detonatePage } from "@/components/detonation/events";
import { useKeySequence } from "./use-key-sequence";

const BOOM = ["b", "o", "o", "m"] as const;

/** Type "boom" anywhere outside an input and the page goes up from the middle. */
export function BoomWord() {
  useKeySequence(BOOM, () => {
    detonatePage({ x: window.innerWidth / 2, y: window.innerHeight / 2 }, "boom");
  });
  return null;
}
