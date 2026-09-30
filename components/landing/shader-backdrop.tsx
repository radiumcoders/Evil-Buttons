"use client";

import { useId, useState } from "react";
import { EvilShader } from "@/components/landing/evil-shader";
import { useAppTheme } from "@/hooks/use-app-theme";

export function ShaderBackdrop() {
  const theme = useAppTheme();
  const [failed, setFailed] = useState(false);

  if (failed) return null;

  // Falls back to the CSS .landing-bg underneath when WebGL2 is unavailable.
  return (
    <EvilShader
      theme={theme}
      onError={(error) => {
        console.warn("Landing shader disabled:", error.message);
        setFailed(true);
      }}
      className="pointer-events-none absolute inset-0 rounded-[inherit]"
    />
  );
}

// Eased stops so the fade has no visible band where it ends.
const scrimStops = [
  [0, 0.92],
  [0.2, 0.8],
  [0.4, 0.58],
  [0.6, 0.32],
  [0.8, 0.1],
  [1, 0],
] as const;

/** Darkens the top of the shader so the navbar and headline stay legible. */
export function TopScrim() {
  // Unique per instance: the hero and the footer both draw one.
  const gradientId = useId();

  return (
    <svg
      aria-hidden="true"
      preserveAspectRatio="none"
      className="pointer-events-none absolute inset-x-0 top-0 h-[60%] w-full"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          {scrimStops.map(([offset, opacity]) => (
            <stop
              key={offset}
              offset={offset}
              stopColor="var(--background)"
              stopOpacity={opacity}
            />
          ))}
        </linearGradient>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${gradientId})`} />
    </svg>
  );
}
