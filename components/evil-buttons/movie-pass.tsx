"use client";

import { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Notch radius for the four corner cutouts. The notches are punched out with a
 * CSS mask instead of background-colored overlays, so the ticket shape works on
 * any surface (no need to match the page background).
 */
const NOTCH = 8;

const cornerNotchMask = [
  `radial-gradient(circle ${NOTCH}px at 0 0, transparent ${NOTCH}px, black ${NOTCH + 0.5}px)`,
  `radial-gradient(circle ${NOTCH}px at 100% 0, transparent ${NOTCH}px, black ${NOTCH + 0.5}px)`,
  `radial-gradient(circle ${NOTCH}px at 0 100%, transparent ${NOTCH}px, black ${NOTCH + 0.5}px)`,
  `radial-gradient(circle ${NOTCH}px at 100% 100%, transparent ${NOTCH}px, black ${NOTCH + 0.5}px)`,
].join(", ");

const notchStyle: CSSProperties = {
  WebkitMaskImage: cornerNotchMask,
  maskImage: cornerNotchMask,
  WebkitMaskRepeat: "no-repeat",
  maskRepeat: "no-repeat",
  // Intersect the four masks so only the corner circles are cut out.
  WebkitMaskComposite: "source-in",
  maskComposite: "intersect",
};

function MoviePassButton({
  children,
  className,
  style,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <button
      style={{ ...notchStyle, ...style }}
      className={cn(
        className,
        "px-6 py-3 bg-primary text-background",
        "relative",
        "active:scale-95 transition-all duration-75",
      )}
    >
      {children}
    </button>
  );
}
export default MoviePassButton;
