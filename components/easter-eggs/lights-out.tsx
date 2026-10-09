"use client";

import { useEffect, useRef, useState } from "react";
import { findEgg } from "./eggs";
import { onEgg } from "./triggers";

const DARK_FOR = 9000;

type Phase = "off" | "dark" | "flicker";

/** Flick the RealisticSwitch hard enough and the fuse blows: you get a flashlight. */
export function LightsOut() {
  const [phase, setPhase] = useState<Phase>("off");
  const overlayRef = useRef<HTMLDivElement | null>(null);

  useEffect(
    () => onEgg("lights", () => setPhase((current) => (current === "off" ? "dark" : current))),
    [],
  );

  useEffect(() => {
    if (phase !== "dark") return;
    findEgg("lights", {
      title: "You blew the fuse.",
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
