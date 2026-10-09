"use client";

import * as React from "react";
import {
  SlideToDetonate as BaseSlideToDetonate,
  type SlideToDetonateProps,
} from "@/components/evil-buttons/slide-to-detonate";
import { detonatePage, preloadDetonation } from "./events";

/** Handle size plus track padding, so the blast centres on the parked handle. */
const HANDLE_INSET = 24;

/**
 * The site's SlideToDetonate: the registry component, except it really does
 * detonate. The registry file stays clean; only the docs and landing use this.
 */
export const SlideToDetonate = React.forwardRef<
  HTMLButtonElement,
  SlideToDetonateProps
>(({ onConfirm, onPointerDown, onFocus, ...props }, ref) => {
  const handleRef = React.useRef<HTMLButtonElement | null>(null);

  const setRefs = React.useCallback(
    (node: HTMLButtonElement | null) => {
      handleRef.current = node;
      if (typeof ref === "function") ref(node);
      else if (ref) ref.current = node;
    },
    [ref],
  );

  return (
    <BaseSlideToDetonate
      ref={setRefs}
      {...props}
      onPointerDown={(event) => {
        onPointerDown?.(event);
        preloadDetonation();
      }}
      onFocus={(event) => {
        onFocus?.(event);
        preloadDetonation();
      }}
      onConfirm={() => {
        onConfirm?.();
        const track = handleRef.current?.parentElement;
        if (!track) return;
        const rect = track.getBoundingClientRect();
        detonatePage({
          x: rect.right - HANDLE_INSET,
          y: rect.top + rect.height / 2,
        });
      }}
    />
  );
});

SlideToDetonate.displayName = "SlideToDetonate";
