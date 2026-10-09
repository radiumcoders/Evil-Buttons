/** Viewport point, in CSS px, where the blast goes off. */
export type DetonationOrigin = { x: number; y: number };

export const DETONATE_EVENT = "evilbuttons:detonate";

/** Sets the whole page on fire from `origin`. Picked up by `<PageDetonation />`. */
export function detonatePage(origin: DetonationOrigin) {
  window.dispatchEvent(
    new CustomEvent<DetonationOrigin>(DETONATE_EVENT, { detail: origin }),
  );
}

/** Warms the overlay chunk so the blast isn't late on the first slide. */
export function preloadDetonation() {
  void import("./detonation-overlay");
}
