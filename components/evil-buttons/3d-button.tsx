"use client";

import * as React from "react";
import { motion, type HTMLMotionProps } from "motion/react";

import { cn } from "@/lib/utils";

type ThreeDButtonProps = HTMLMotionProps<"button"> & {
  children?: React.ReactNode;
};

const pressTransition = {
  type: "spring",
  stiffness: 620,
  damping: 32,
  mass: 0.5,
} as const;

export function ThreeDButton({
  className,
  children = "Continue",
  ...props
}: ThreeDButtonProps) {
  return (
    <motion.button
      initial="rest"
      whileHover="hover"
      whileTap="tap"
      className={cn(
        "group relative isolate inline-flex min-w-38 cursor-pointer rounded-full pb-1.5 outline-none",
        "focus-visible:ring-2 focus-visible:ring-zinc-500 focus-visible:ring-offset-2",
        "dark:focus-visible:ring-white",
        "disabled:pointer-events-none disabled:opacity-50",
        className,
      )}
      {...props}
    >
      {/* Deck (bottom layer / shadow block) */}
      <motion.span
        aria-hidden
        variants={{
          rest: { y: 0 },
          hover: { y: 1 },
          tap: { y: -1 },
        }}
        transition={pressTransition}
        className="absolute inset-x-0 bottom-0 top-1.5 -z-10 rounded-full bg-zinc-950 shadow-[0_10px_18px_rgba(24,24,27,0.2)] dark:bg-white dark:shadow-[0_10px_18px_rgba(255,255,255,0.15)]"
      />
      {/* Face (top layer / button surface) */}
      <motion.span
        variants={{
          // Whole-pixel moves only: tilting or fractionally scaling the face makes
          // Chrome drop anti-aliasing on its edge, which shows up as a dashed rim.
          rest: { y: 0 },
          hover: { y: -2 },
          tap: { y: 6 },
        }}
        transition={pressTransition}
        className={cn(
          "relative z-10 inline-flex w-full items-center justify-center overflow-hidden rounded-full px-7 py-3",
          "bg-zinc-50 text-sm font-semibold text-zinc-950 dark:bg-zinc-900 dark:text-white",
          // The rim is an inset ring rather than a border so it stays smooth while the face moves.
          "shadow-[inset_0_0_0_1px_rgb(212_212_216),inset_0_2px_0_rgba(255,255,255,0.9),inset_0_-2px_0_rgba(24,24,27,0.06)]",
          "dark:shadow-[inset_0_0_0_1px_rgb(255_255_255),inset_0_2px_0_rgba(255,255,255,0.15),inset_0_-2px_0_rgba(0,0,0,0.3)]",
          "backface-hidden will-change-transform",
        )}
      >
        {/* Press spot (darkens on press) */}
        <motion.span
          aria-hidden
          variants={{
            rest: { opacity: 0, scaleX: 0.25 },
            hover: { opacity: 0.3, scaleX: 0.45 },
            tap: { opacity: 1, scaleX: 1 },
          }}
          transition={pressTransition}
          className="pointer-events-none absolute inset-y-1 left-1/2 w-10 -translate-x-1/2 rounded-full bg-zinc-950/10 dark:bg-white/20 blur-sm"
        />
        {/* Sheen / gloss stripe */}
        <motion.span
          aria-hidden
          variants={{
            // Parked fully off the left edge so no sliver of it shows at rest.
            rest: { opacity: 0, x: "-100%" },
            hover: { opacity: 0.75, x: "-35%" },
            tap: { opacity: 0.9, x: "82%" },
          }}
          transition={pressTransition}
          className="pointer-events-none absolute inset-y-0 left-0 w-1/2 bg-linear-to-r from-transparent via-white to-transparent dark:via-white/20"
        />
        {/* Label */}
        <motion.span
          variants={{
            rest: { y: 0 },
            hover: { y: -1 },
            tap: { y: 1 },
          }}
          transition={pressTransition}
          className="relative z-10"
        >
          {children}
        </motion.span>
      </motion.span>
    </motion.button>
  );
}
