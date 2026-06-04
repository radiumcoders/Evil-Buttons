"use client";

import { useLayoutEffect, useRef, type ReactNode } from "react";

/**
 * Scales its child down to fit the available space, like an SVG `viewBox`. Fits
 * the union of every descendant's box, so content painting outside its layout
 * box (glows, negative-inset gradients) is included rather than clipped — a
 * child that paints far outside its box will shrink the whole component.
 */
export function FitToContainer({
  children,
  max = 1, // never upscale past natural size
  className,
}: {
  children: ReactNode;
  max?: number;
  className?: string;
}) {
  const outer = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const scaleRef = useRef(1); // currently-applied scale, written to the DOM as --fit-scale

  useLayoutEffect(() => {
    const outerEl = outer.current;
    const innerEl = inner.current;
    if (!outerEl || !innerEl) return;

    const measure = () => {
      const availableWidth = outerEl.clientWidth;
      const availableHeight = outerEl.clientHeight;
      if (!availableWidth || !availableHeight) return;

      // Rects include the currently-applied transform, so divide it back out to
      // recover the natural (unscaled) footprint. Re-derived each pass so it
      // stays correct if the effect re-runs while a scale is already applied.
      const appliedScale = scaleRef.current || 1;
      let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;
      for (const node of [innerEl, ...innerEl.querySelectorAll<HTMLElement>("*")]) {
        const rect = node.getBoundingClientRect();
        if (rect.width === 0 && rect.height === 0) continue;
        if (rect.left < left) left = rect.left;
        if (rect.top < top) top = rect.top;
        if (rect.right > right) right = rect.right;
        if (rect.bottom > bottom) bottom = rect.bottom;
      }
      if (!isFinite(left)) return;
      const naturalWidth = (right - left) / appliedScale;
      const naturalHeight = (bottom - top) / appliedScale;
      if (!naturalWidth || !naturalHeight) return;

      // Write straight to the DOM, not state: avoids re-rendering the child on
      // every resize when the value only drives one style.
      const nextScale = Math.min(max, availableWidth / naturalWidth, availableHeight / naturalHeight);
      if (Math.abs(nextScale - scaleRef.current) > 0.005) {
        scaleRef.current = nextScale;
        innerEl.style.setProperty("--fit-scale", String(nextScale));
      }
    };

    // Measure synchronously: ResizeObserver fires in hidden tabs (rAF doesn't),
    // and we only mutate --fit-scale, never the observed border-box, so no loop.
    const observer = new ResizeObserver(measure);
    observer.observe(outerEl);
    observer.observe(innerEl);
    measure();

    return () => observer.disconnect();
  }, [max]);

  return (
    <div
      ref={outer}
      className={className}
      style={{
        display: "grid",
        // minmax(0, 1fr) clamps the track to the container so an oversized child
        // overflows symmetrically and scales around its true center (plain
        // 1fr/auto grows to max-content and off-centers it).
        gridTemplateColumns: "minmax(0, 1fr)",
        gridTemplateRows: "minmax(0, 1fr)",
        placeItems: "center",
        overflow: "hidden",
        width: "100%",
        height: "100%",
      }}
    >
      <div ref={inner} style={{ transform: "scale(var(--fit-scale, 1))", transformOrigin: "center" }}>
        {children}
      </div>
    </div>
  );
}
