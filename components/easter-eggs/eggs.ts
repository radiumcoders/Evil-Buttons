import { useSyncExternalStore } from "react";
import { showEggToast } from "./egg-toast";

export const EASTER_EGGS = [
  "detonate",
  "boom",
  "hell",
  "lights",
  "eyes",
  "cracks",
  "tab",
] as const;

export type EasterEgg = (typeof EASTER_EGGS)[number];

/** What the hunt panel shows: a riddle until found, then how it was done. */
export const EGG_INFO: Record<EasterEgg, { name: string; hint: string; how: string }> = {
  detonate: {
    name: "Detonation",
    hint: "Some sliders mean exactly what they say.",
    how: "Slide any SlideToDetonate all the way.",
  },
  boom: {
    name: "Boom",
    hint: "No slider handy? Type the sound it makes.",
    how: "Type “boom” anywhere outside an input.",
  },
  hell: {
    name: "Hell mode",
    hint: "Up, up, down, down… the oldest cheat code there is.",
    how: "↑ ↑ ↓ ↓ ← → ← → B A",
  },
  lights: {
    name: "Lights out",
    hint: "Can't pick light or dark? Keep flipping. Fast.",
    how: "Flip the theme 4 times in a row (or mash D).",
  },
  eyes: {
    name: "Watchers",
    hint: "Sit perfectly still for a while. You're not alone.",
    how: "Leave the page untouched for 30 seconds.",
  },
  cracks: {
    name: "Cracked",
    hint: "Take your anger out on the empty space.",
    how: "Rage-click anywhere that isn't a button.",
  },
  tab: {
    name: "Separation anxiety",
    hint: "Try leaving. See how it takes it.",
    how: "Switch to another tab, then come back.",
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

const EDITABLE_TAGS = new Set(["INPUT", "TEXTAREA", "SELECT"]);

export function isEditableTarget(target: EventTarget | null) {
  const element = target as HTMLElement | null;
  if (!element) return false;
  return EDITABLE_TAGS.has(element.tagName) || element.isContentEditable;
}
