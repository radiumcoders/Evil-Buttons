"use client";

import * as React from "react";
import { BrutalButton as BaseBrutalButton } from "@/components/evil-buttons/brutal-button";
import { DemonicButton as BaseDemonicButton } from "@/components/evil-buttons/demonic-button";
import { DoubtButton as BaseDoubtButton } from "@/components/evil-buttons/doubt-button";
import BaseEvilEyeButton from "@/components/evil-buttons/evil-eye-button";
import { GlitchButton as BaseGlitchButton } from "@/components/evil-buttons/glitch-button";
import { RealisticSwitch as BaseRealisticSwitch } from "@/components/evil-buttons/realistic-switch";
import { showEggToast } from "./egg-toast";
import { useFoundEggs } from "./eggs";
import { centreOf, createBurstCounter, fireEgg } from "./triggers";

/*
 * The site's copies of the buttons that hide eggs. Each one is the registry
 * component untouched, plus a listener for the interaction that sets its egg
 * off. Installed copies stay clean; only the docs and landing use these.
 */

/** Fast clicks, within this many ms, that count as smashing a button. */
const SMASH_WINDOW = 1400;
const SMASH_CLICKS = 4;
/** How long you have to hold the Evil Eye's gaze. */
const STARE_MS = 2500;
const FLIP_WINDOW = 4000;
const FLIPS = 4;

/** Hold until the demon is summoned and it takes the whole site to hell. */
export function DemonicButton({ onSummon, ...props }: React.ComponentProps<typeof BaseDemonicButton>) {
  return (
    <BaseDemonicButton
      {...props}
      onSummon={() => {
        onSummon?.();
        fireEgg("hell");
      }}
    />
  );
}

/** Get through every doubt and it really does delete everything. */
export function DoubtButton({ onConfirm, ...props }: React.ComponentProps<typeof BaseDoubtButton>) {
  return (
    <BaseDoubtButton
      {...props}
      onConfirm={() => {
        onConfirm?.();
        fireEgg("deleted");
      }}
    />
  );
}

/** Stare into the eye long enough and the page stares back. */
export function EvilEyeButton({
  onPointerEnter,
  onPointerLeave,
  ...props
}: React.ComponentProps<typeof BaseEvilEyeButton>) {
  const timeoutRef = React.useRef<number | null>(null);
  const stop = () => {
    if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
    timeoutRef.current = null;
  };
  React.useEffect(() => stop, []);

  return (
    <BaseEvilEyeButton
      {...props}
      onPointerEnter={(event) => {
        onPointerEnter?.(event);
        if (event.pointerType === "touch") return;
        stop();
        timeoutRef.current = window.setTimeout(() => {
          timeoutRef.current = null;
          fireEgg("eyes");
        }, STARE_MS);
      }}
      onPointerLeave={(event) => {
        onPointerLeave?.(event);
        stop();
      }}
    />
  );
}

/** Smash it and something gives: the screen, around the button. */
export function BrutalButton({ onClick, ...props }: React.ComponentProps<typeof BaseBrutalButton>) {
  const [counter] = React.useState(() => createBurstCounter(SMASH_WINDOW));
  return (
    <BaseBrutalButton
      {...props}
      onClick={(event) => {
        onClick?.(event);
        if (counter.hit() >= SMASH_CLICKS) fireEgg("cracks", centreOf(event.currentTarget));
      }}
    />
  );
}

/** Mash it and the glitch gets out of the button and into the page. */
export function GlitchButton({ onClick, ...props }: React.ComponentProps<typeof BaseGlitchButton>) {
  const [counter] = React.useState(() => createBurstCounter(SMASH_WINDOW));
  return (
    <BaseGlitchButton
      {...props}
      onClick={(event) => {
        onClick?.(event);
        if (counter.hit() >= SMASH_CLICKS) {
          counter.reset();
          fireEgg("glitch", centreOf(event.currentTarget));
        }
      }}
    />
  );
}

/** Flick it on and off fast enough and the fuse blows. */
export function RealisticSwitch({
  onCheckedChange,
  ...props
}: React.ComponentProps<typeof BaseRealisticSwitch>) {
  const [counter] = React.useState(() => createBurstCounter(FLIP_WINDOW));
  const found = useFoundEggs().includes("lights");
  return (
    <BaseRealisticSwitch
      {...props}
      onCheckedChange={(checked) => {
        onCheckedChange?.(checked);
        const flips = counter.hit();
        // Halfway there the bulbs complain, so people know to keep going.
        if (flips === 2 && !found) {
          showEggToast({ title: "The bulbs flicker…", note: "Old wiring. Don't push it." });
        }
        if (flips >= FLIPS) {
          counter.reset();
          fireEgg("lights");
        }
      }}
    />
  );
}
