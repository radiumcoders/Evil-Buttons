import type { EasterEgg } from "@/components/easter-eggs/eggs";

/** Viewport point, in CSS px, where the blast goes off. */
export type DetonationOrigin = { x: number; y: number };

type DetonationDetail = DetonationOrigin & { egg: EasterEgg };

export type { DetonationDetail };

export const DETONATE_EVENT = "evilbuttons:detonate";

/** Sets the whole page on fire from `origin`. Picked up by `<PageDetonation />`. */
export function detonatePage(
  origin: DetonationOrigin,
  egg: EasterEgg = "detonate",
) {
  window.dispatchEvent(
    new CustomEvent<DetonationDetail>(DETONATE_EVENT, {
      detail: { ...origin, egg },
    }),
  );
}

/** Warms the overlay chunk so the blast isn't late on the first slide. */
export function preloadDetonation() {
  void import("./detonation-overlay");
}
