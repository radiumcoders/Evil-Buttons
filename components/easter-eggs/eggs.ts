import { useSyncExternalStore } from "react";
import { showEggToast } from "./egg-toast";

export const EASTER_EGGS = [
  "detonate",
  "hell",
  "deleted",
  "eyes",
  "cracks",
  "glitch",
  "lights",
  "flip",
  "skulls",
  "creeper",
] as const;

export type EasterEgg = (typeof EASTER_EGGS)[number];

/** What the hunt panel shows: a riddle until found, then how it was done. */
export const EGG_INFO: Record<EasterEgg, { name: string; hint: string; how: string }> = {
  detonate: {
    name: "Detonation",
    hint: "One slider means exactly what it says.",
    how: "Slide SlideToDetonate all the way.",
  },
  hell: {
    name: "Hell mode",
    hint: "Something with horns wants out. Hold on long enough to let it.",
    how: "Hold DemonicButton until the demon is summoned.",
  },
  deleted: {
    name: "Everything deleted",
    hint: "It keeps asking if you're sure. Be sure.",
    how: "Confirm every doubt on DoubtButton.",
  },
  eyes: {
    name: "Watchers",
    hint: "Stare into the eye. Don't blink, don't look away.",
    how: "Hover EvilEyeButton for a few seconds.",
  },
  cracks: {
    name: "Cracked",
    hint: "The brutal one can take a hit. Can the screen?",
    how: "Smash BrutalButton four times fast.",
  },
  glitch: {
    name: "Corrupted",
    hint: "The glitch is contained in its button. For now.",
    how: "Mash GlitchButton four times fast.",
  },
  lights: {
    name: "Lights out",
    hint: "That switch has old wiring. Flick it like you mean it.",
    how: "Flip RealisticSwitch four times fast.",
  },
  flip: {
    name: "Trolled",
    hint: "The one that runs away has a temper. Catch it anyway.",
    how: "Catch TrollButton once it gets tired.",
  },
  skulls: {
    name: "Party's over",
    hint: "One burst of confetti is restrained. Five is a different party.",
    how: "Click ConfettiButton five times fast.",
  },
  creeper: {
    name: "Ssssss",
    hint: "Break the stone button. Something green was hiding behind it.",
    how: "Mine MinecraftButton until it breaks.",
  },
};

const STORAGE_KEY = "evilbuttons:eggs";
const NONE: readonly EasterEgg[] = [];

function readFound(): EasterEgg[] {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
    if (!Array.isArray(stored)) return [];
    return EASTER_EGGS.filter((egg) => stored.includes(egg));
  } catch {
    return [];
  }
}

let snapshot: readonly EasterEgg[] | null = null;
const listeners = new Set<() => void>();

function changed() {
  snapshot = null;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  // Another tab found one.
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) changed();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

function getSnapshot() {
  snapshot ??= readFound();
  return snapshot;
}

/** The eggs found in this browser, kept live. */
export function useFoundEggs() {
  return useSyncExternalStore(subscribe, getSnapshot, () => NONE);
}

export function eggProgress() {
  return { found: getSnapshot().length, total: EASTER_EGGS.length };
}

function write(found: readonly EasterEgg[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(found));
  } catch {
    // Private mode: the egg still hatches, it just isn't remembered.
  }
  changed();
}

export function resetEggs() {
  write([]);
}

/** A riddle for an egg still out there, so every find leads to the next. */
export function nextHint(found: readonly EasterEgg[] = getSnapshot()) {
  const left = EASTER_EGGS.filter((egg) => !found.includes(egg));
  if (left.length === 0) return null;
  return EGG_INFO[left[Math.floor(Math.random() * left.length)]].hint;
}

type EggToast = {
  title: string;
  note?: string;
  /** Only toast the first time this egg is found. */
  onlyFirst?: boolean;
};

/** Records `egg` as found and, unless told to stay quiet, says so in a toast. */
export function findEgg(egg: EasterEgg, toast?: EggToast) {
  const before = getSnapshot();
  const isNew = !before.includes(egg);
  const found = isNew ? EASTER_EGGS.filter((e) => e === egg || before.includes(e)) : before;
  if (isNew) write(found);
  if (toast && (isNew || !toast.onlyFirst)) {
    const complete = found.length === EASTER_EGGS.length;
    showEggToast({
      title: toast.title,
      note: toast.note,
      progress: { found: found.length, total: EASTER_EGGS.length },
      next: complete ? "All of them. You are truly evil." : `Next: ${nextHint(found)}`,
    });
  }
}
