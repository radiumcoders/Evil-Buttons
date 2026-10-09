"use client";

import { useEffect, useRef, useState } from "react";
import { showEggToast } from "./egg-toast";
import { findEgg, useFoundEggs } from "./eggs";

/** Theme flips inside WINDOW ms that count as abuse. */
const FLIPS = 4;
const WINDOW = 4000;
const DARK_FOR = 9000;

type Phase = "off" | "dark" | "flicker";

/** Flick the theme back and forth enough and the lights blow: you get a flashlight. */
export function LightsOut() {
  const [phase, setPhase] = useState<Phase>("off");
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const found = useFoundEggs().includes("lights");
  const foundRef = useRef(found);
  useEffect(() => {
    foundRef.current = found;
  }, [found]);

  // Watch the class rather than the toggles, so the buttons and the `d` shortcut all count.
  useEffect(() => {
    const html = document.documentElement;
    let dark = html.classList.contains("dark");
    let hell = html.hasAttribute("data-hell");
    const flips: number[] = [];
    let nudged = false;
    const observer = new MutationObserver(() => {
      const next = html.classList.contains("dark");
      const nextHell = html.hasAttribute("data-hell");
      const hellChanged = nextHell !== hell;
      hell = nextHell;
      if (next === dark) return;
      dark = next;
      // Hell mode forces dark on its way in and out; that's not the visitor flipping.
      if (hellChanged) return;
      const now = performance.now();
      flips.push(now);
      while (flips.length && now - flips[0] > WINDOW) flips.shift();
      // Halfway there, the bulbs complain, so people know to keep going.
      if (flips.length === 2 && !nudged && !foundRef.current) {
        nudged = true;
        showEggToast({ title: "The bulbs flicker…", note: "They're old. Don't push it." });
      }
      if (flips.length >= FLIPS) {
        flips.length = 0;
        setPhase((current) => (current === "off" ? "dark" : current));
      }
    });
    observer.observe(html, { attributes: true, attributeFilter: ["class", "data-hell"] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (phase !== "dark") return;
    findEgg("lights", {
      title: "You broke the lights.",
      note: "Hope you like the dark.",
    });

    const aim = (x: number, y: number) => {
      overlayRef.current?.style.setProperty("--x", `${x}px`);
      overlayRef.current?.style.setProperty("--y", `${y}px`);
    };
    const onPointer = (event: PointerEvent) => aim(event.clientX, event.clientY);
    aim(window.innerWidth / 2, window.innerHeight / 2);
    window.addEventListener("pointermove", onPointer, { passive: true });
    window.addEventListener("pointerdown", onPointer, { passive: true });
    const timeout = window.setTimeout(() => setPhase("flicker"), DARK_FOR);
    return () => {
      window.removeEventListener("pointermove", onPointer);
      window.removeEventListener("pointerdown", onPointer);
      window.clearTimeout(timeout);
    };
  }, [phase]);

  if (phase === "off") return null;
  return (
    <div
      ref={overlayRef}
      aria-hidden
      data-phase={phase}
      className="lights-out"
      onAnimationEnd={() => {
        if (phase === "flicker") setPhase("off");
      }}
    />
  );
}
