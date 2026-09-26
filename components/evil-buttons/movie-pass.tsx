"use client";

import * as React from "react";
import { motion, useReducedMotion, type Transition } from "motion/react";
import { cn } from "@/lib/utils";

export type MoviePassVariant = "tilt" | "snap";

export interface MoviePassButtonProps
  extends Omit<
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    | "children"
    | "onAnimationStart"
    | "onDrag"
    | "onDragEnd"
    | "onDragStart"
  > {
  /** Label printed on the main part of the ticket. */
  children?: React.ReactNode;
  /** Content of the tear-off stub. */
  stub?: React.ReactNode;
  /**
   * How the ticket tears on click.
   * - `tilt`: both halves hinge outward from the bottom of the perforation.
   * - `snap`: the stub splits off in a straight line, leaving a small gap.
   * @default "tilt"
   */
  variant?: MoviePassVariant;
  /**
   * Milliseconds before the ticket mends itself. Pass `null` to stay torn
   * until the next click.
   * @default 1800
   */
  resetDelay?: number | null;
  /** Fired each time the ticket tears. */
  onTear?: () => void;
}

/**
 * Notch radius for the corner cutouts. Each half is notched on all four
 * corners, so the two halves together form half-circle punches at the
 * perforation. Masks keep the shape correct on any page background.
 */
const NOTCH = 6;

const cornerNotchMask = [
  `radial-gradient(circle ${NOTCH}px at 0 0, transparent ${NOTCH}px, black ${NOTCH + 0.5}px)`,
  `radial-gradient(circle ${NOTCH}px at 100% 0, transparent ${NOTCH}px, black ${NOTCH + 0.5}px)`,
  `radial-gradient(circle ${NOTCH}px at 0 100%, transparent ${NOTCH}px, black ${NOTCH + 0.5}px)`,
  `radial-gradient(circle ${NOTCH}px at 100% 100%, transparent ${NOTCH}px, black ${NOTCH + 0.5}px)`,
].join(", ");

const notchStyle: React.CSSProperties = {
  WebkitMaskImage: cornerNotchMask,
  maskImage: cornerNotchMask,
  WebkitMaskRepeat: "no-repeat",
  maskRepeat: "no-repeat",
  // Intersect the four masks so only the corner circles are cut out.
  WebkitMaskComposite: "source-in",
  maskComposite: "intersect",
};

const TEAR = {
  snap: {
    main: { x: -3, rotate: 0 },
    stub: { x: 3, rotate: 0 },
  },
  // Rotating around the shared bottom corners keeps the halves touching at
  // the bottom while a V opens along the perforation.
  tilt: {
    main: { x: 0, rotate: -6 },
    stub: { x: 0, rotate: 10 },
  },
} as const;

const REST = { x: 0, rotate: 0 };

const TRANSITIONS: Record<MoviePassVariant, Transition> = {
  snap: { type: "spring", stiffness: 700, damping: 22, mass: 0.6 },
  tilt: { type: "spring", stiffness: 320, damping: 13, mass: 0.8 },
};

const MEND: Transition = { type: "spring", stiffness: 420, damping: 30 };

function DefaultStub() {
  return (
    <span className="flex flex-col items-center leading-none">
      <span className="text-[8px] tracking-[0.2em] opacity-60">NO.</span>
      <span className="mt-0.5 font-mono text-xs font-semibold">01</span>
    </span>
  );
}

export const MoviePassButton = React.forwardRef<
  HTMLButtonElement,
  MoviePassButtonProps
>(
  (
    {
      children,
      stub = <DefaultStub />,
      variant = "tilt",
      resetDelay = 1800,
      onTear,
      onClick,
      className,
      style,
      type = "button",
      ...props
    },
    ref,
  ) => {
    const reduceMotion = useReducedMotion();
    const [torn, setTorn] = React.useState(false);
    const timeoutRef = React.useRef<number | null>(null);

    const clearTimer = React.useCallback(() => {
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    }, []);

    React.useEffect(() => clearTimer, [clearTimer]);

    const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
      onClick?.(event);
      if (event.defaultPrevented) return;

      clearTimer();

      if (torn) {
        setTorn(false);
        return;
      }

      setTorn(true);
      onTear?.();

      if (resetDelay !== null) {
        timeoutRef.current = window.setTimeout(() => {
          timeoutRef.current = null;
          setTorn(false);
        }, resetDelay);
      }
    };

    const pose = torn ? TEAR[variant] : { main: REST, stub: REST };
    const transition: Transition = reduceMotion
      ? { duration: 0 }
      : torn
        ? TRANSITIONS[variant]
        : MEND;

    return (
      <button
        ref={ref}
        type={type}
        onClick={handleClick}
        data-state={torn ? "torn" : "intact"}
        data-variant={variant}
        aria-pressed={resetDelay === null ? torn : undefined}
        style={style}
        className={cn(
          "group relative inline-flex h-11 cursor-pointer items-stretch bg-transparent p-0 text-sm font-medium text-neutral-50 outline-none select-none",
          // The halves are masked for the notches, which clips box-shadow, so the hairline ring and soft drop are drop-shadows that follow the ticket's outline.
          "[filter:drop-shadow(0_0_0.5px_rgb(0_0_0/0.9))_drop-shadow(0_0_0.5px_rgb(0_0_0/0.9))_drop-shadow(0_1px_1px_rgb(0_0_0/0.25))_drop-shadow(0_4px_5px_rgb(0_0_0/0.25))]",
          "transition-[scale,filter] duration-300 ease-[cubic-bezier(0.34,1.35,0.64,1)]",
          // Press eases in fast and settles the drop; release springs back on the slower base curve.
          "active:scale-[0.97] active:duration-100 active:ease-out active:[filter:drop-shadow(0_0_0.5px_rgb(0_0_0/0.9))_drop-shadow(0_0_0.5px_rgb(0_0_0/0.9))_drop-shadow(0_0_1px_rgb(0_0_0/0.2))_drop-shadow(0_1px_1.5px_rgb(0_0_0/0.2))] motion-reduce:active:scale-100",
          "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          "disabled:pointer-events-none disabled:opacity-50",
          className,
        )}
        {...props}
      >
        <motion.span
          initial={false}
          animate={pose.main}
          transition={transition}
          style={{ ...notchStyle, transformOrigin: "100% 100%" }}
          className="flex items-center px-6 bg-linear-to-b from-[#353535] to-[#272727] shadow-[inset_0_1px_0_rgb(255_255_255/0.14)] transition-[filter] duration-300 group-hover:brightness-110 group-active:brightness-95"
        >
          {children}
        </motion.span>
        <motion.span
          aria-hidden
          initial={false}
          animate={pose.stub}
          transition={transition}
          style={{ ...notchStyle, transformOrigin: "0% 100%" }}
          className="relative flex min-w-12 items-center justify-center px-3 font-mono text-xs text-neutral-50/70 bg-linear-to-b from-[#353535] to-[#272727] shadow-[inset_0_1px_0_rgb(255_255_255/0.14)] transition-[filter] duration-300 group-hover:brightness-110 group-active:brightness-95"
        >
          {/* Perforation along the tear line. */}
          <span className="absolute inset-y-2 left-0 w-px bg-[linear-gradient(to_bottom,currentColor_50%,transparent_50%)] bg-size-[1px_5px] opacity-40" />
          {stub}
        </motion.span>
      </button>
    );
  },
);

MoviePassButton.displayName = "MoviePassButton";

export default MoviePassButton;
