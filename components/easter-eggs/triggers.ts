/** Eggs whose effects live in the root layout, set off by the site's buttons. */
export type EggEffect =
  | "hell"
  | "deleted"
  | "eyes"
  | "cracks"
  | "glitch"
  | "lights"
  | "flip"
  | "skulls"
  | "creeper";

export type EggPoint = { x: number; y: number };

const eventName = (effect: EggEffect) => `evilbuttons:egg:${effect}`;

/** Sets off an egg's effect, optionally from a point on screen (in CSS px). */
export function fireEgg(effect: EggEffect, point?: EggPoint) {
  window.dispatchEvent(new CustomEvent<EggPoint | undefined>(eventName(effect), { detail: point }));
}

/** Listens for `fireEgg(effect)`; returns the unsubscribe. */
export function onEgg(effect: EggEffect, listener: (point: EggPoint | undefined) => void) {
  const handler = (event: Event) => listener((event as CustomEvent<EggPoint | undefined>).detail);
  window.addEventListener(eventName(effect), handler);
  return () => window.removeEventListener(eventName(effect), handler);
}

/** Centre of an element, for effects that start at the button. */
export function centreOf(element: Element): EggPoint {
  const rect = element.getBoundingClientRect();
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

/** Counts events inside a sliding window; `hit()` returns how many are in it. */
export function createBurstCounter(windowMs: number) {
  let times: number[] = [];
  return {
    hit() {
      const now = performance.now();
      times = times.filter((t) => now - t < windowMs);
      times.push(now);
      return times.length;
    },
    reset() {
      times = [];
    },
  };
}
