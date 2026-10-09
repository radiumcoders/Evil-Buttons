"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { findEgg } from "@/components/easter-eggs/eggs";
import {
  DETONATE_EVENT,
  type DetonationDetail,
  type DetonationOrigin,
} from "./events";

// Only fetched once something actually detonates.
const DetonationOverlay = dynamic(() => import("./detonation-overlay"), {
  ssr: false,
});

/**
 * Easter egg host: listens for `detonatePage()` (fired by the site's
 * SlideToDetonate) and burns the page down from that point.
 */
export function PageDetonation() {
  const [origin, setOrigin] = useState<DetonationOrigin | null>(null);

  useEffect(() => {
    const onDetonate = (event: Event) => {
      const { detail } = event as CustomEvent<DetonationDetail>;
      // The overlay's end card announces it, so no toast.
      findEgg(detail.egg);
      // One fire at a time.
      setOrigin((current) => current ?? { x: detail.x, y: detail.y });
    };
    window.addEventListener(DETONATE_EVENT, onDetonate);
    return () => window.removeEventListener(DETONATE_EVENT, onDetonate);
  }, []);

  if (!origin) return null;
  return <DetonationOverlay origin={origin} onDone={() => setOrigin(null)} />;
}
