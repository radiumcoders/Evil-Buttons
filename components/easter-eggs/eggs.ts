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

const STORAGE_KEY = "evilbuttons:eggs";

function readFound(): Set<EasterEgg> {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
    if (!Array.isArray(stored)) return new Set();
    return new Set(EASTER_EGGS.filter((egg) => stored.includes(egg)));
  } catch {
    return new Set();
  }
}

export function eggProgress() {
  return { found: readFound().size, total: EASTER_EGGS.length };
}

type EggToast = {
  title: string;
  note?: string;
  /** Only toast the first time this egg is found. */
  onlyFirst?: boolean;
};

/** Records `egg` as found and, unless told to stay quiet, says so in a toast. */
export function findEgg(egg: EasterEgg, toast?: EggToast) {
  const found = readFound();
  const isNew = !found.has(egg);
  found.add(egg);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...found]));
  } catch {
    // Private mode: the egg still hatches, it just isn't remembered.
  }
  if (toast && (isNew || !toast.onlyFirst)) {
    showEggToast({
      title: toast.title,
      note: toast.note,
      found: found.size,
      total: EASTER_EGGS.length,
    });
  }
}

const EDITABLE_TAGS = new Set(["INPUT", "TEXTAREA", "SELECT"]);

export function isEditableTarget(target: EventTarget | null) {
  const element = target as HTMLElement | null;
  if (!element) return false;
  return EDITABLE_TAGS.has(element.tagName) || element.isContentEditable;
}
