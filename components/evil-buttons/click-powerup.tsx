"use client";

import * as React from "react";
import { motion, useReducedMotion, type Variants } from "motion/react";
import { cn } from "@/lib/utils";

export interface ClickPowerUpProps extends Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  "onDrag" | "onDragStart" | "onDragEnd" | "onAnimationStart"
> {
  /** Milliseconds the powered-up flash lasts after a click. */
  tapDuration?: number;
  /** Color of the powered-up flash. */
  accentColor?: string;
}

type Phase = "rest" | "hover" | "tap" | "powered";

const SPRING = { type: "spring", stiffness: 320, damping: 22 } as const;

const CORNERS = [
  { key: "tl", x: -1, y: -1, className: "top-0 left-0 border-t border-l" },
  { key: "tr", x: 1, y: -1, className: "top-0 right-0 border-t border-r" },
  { key: "bl", x: -1, y: 1, className: "bottom-0 left-0 border-b border-l" },
  { key: "br", x: 1, y: 1, className: "right-0 bottom-0 border-r border-b" },
] as const;

const bracketVariants: Variants = {
  rest: { x: 0, y: 0, opacity: 0.45 },
  hover: ({ x, y }: { x: number; y: number }) => ({
    x: x * 4,
    y: y * 4,
    opacity: 1,
  }),
  tap: ({ x, y }: { x: number; y: number }) => ({
    x: -x * 2,
    y: -y * 2,
    opacity: 1,
  }),
  // Bouncy spring so the brackets overshoot outward, then settle.
  powered: ({ x, y }: { x: number; y: number }) => ({
    x: x * 6,
    y: y * 6,
    opacity: 1,
    transition: { type: "spring", stiffness: 600, damping: 11 },
  }),
};

const panelVariants: Variants = {
  rest: { scaleX: 0 },
  hover: { scaleX: 1 },
  tap: { scaleX: 1 },
  powered: { scaleX: 1 },
};

export const ClickPowerUp = React.forwardRef<
  HTMLButtonElement,
  ClickPowerUpProps
>(
  (
    {
      children,
      className,
      tapDuration = 500,
      accentColor = "#2CD4BD",
      onClick,
      onPointerEnter,
      onPointerLeave,
      onPointerDown,
      onPointerUp,
      style,
      disabled,
      type = "button",
      ...props
    },
    ref,
  ) => {
    const reduceMotion = useReducedMotion();
    const [hovered, setHovered] = React.useState(false);
    const [pressed, setPressed] = React.useState(false);
    const [powered, setPowered] = React.useState(false);
    const poweredTimerRef = React.useRef<number | undefined>(undefined);

    React.useEffect(
      () => () => window.clearTimeout(poweredTimerRef.current),
      [],
    );

    const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
      onClick?.(event);
      setPowered(true);
      window.clearTimeout(poweredTimerRef.current);
      poweredTimerRef.current = window.setTimeout(
        () => setPowered(false),
        tapDuration,
      );
    };

    // Pressing wins so every click, even mid power-up, snaps in then bursts out.
    const phase: Phase = pressed
      ? "tap"
      : powered
        ? "powered"
        : hovered
          ? "hover"
          : "rest";

    return (
      <motion.button
        ref={ref}
        type={type}
        disabled={disabled}
        initial={false}
        animate={phase}
        onClick={handleClick}
        onPointerDown={(event) => {
          onPointerDown?.(event);
          if (event.button === 0) setPressed(true);
        }}
        onPointerUp={(event) => {
          onPointerUp?.(event);
          setPressed(false);
        }}
        onPointerCancel={() => setPressed(false)}
        onPointerEnter={(event) => {
          onPointerEnter?.(event);
          if (event.pointerType !== "touch") setHovered(true);
        }}
        onPointerLeave={(event) => {
          onPointerLeave?.(event);
          setHovered(false);
          setPressed(false);
        }}
        style={{ "--powerup": accentColor, ...style } as React.CSSProperties}
        className={cn(
          "group/powerup relative inline-flex cursor-pointer items-center justify-center px-10 py-3 text-sm font-medium tracking-[0.18em] uppercase outline-none select-none",
          "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        {...props}
      >
        {/* Face: hatched surface with a panel that wipes in when armed. */}
        <span
          aria-hidden
          className="absolute inset-0 overflow-hidden bg-background [--hatch:color-mix(in_oklab,var(--foreground)_10%,transparent)]"
        >
          <span className="absolute inset-0 bg-[repeating-linear-gradient(315deg,var(--hatch)_0,var(--hatch)_1px,transparent_0,transparent_50%)] bg-size-[7px_7px]" />
          <motion.span
            variants={panelVariants}
            transition={SPRING}
            className="absolute inset-0 origin-left bg-foreground"
          />
          <motion.span
            className="absolute inset-0 bg-(--powerup)"
            initial={false}
            animate={{ opacity: powered ? 1 : 0 }}
            transition={{ duration: powered ? 0.08 : 0.3 }}
          />
        </span>

        {CORNERS.map((corner) => (
          <motion.span
            key={corner.key}
            aria-hidden
            custom={corner}
            variants={reduceMotion ? undefined : bracketVariants}
            transition={SPRING}
            className={cn(
              "pointer-events-none absolute z-10 size-2.5 border-foreground",
              phase === "powered" && "border-(--powerup)",
              corner.className,
            )}
          />
        ))}

        <motion.span
          className={cn(
            "relative z-10 transition-colors duration-150",
            phase === "rest" && "text-foreground",
            (phase === "hover" || phase === "tap") && "text-background",
            phase === "powered" && "text-neutral-950",
          )}
          variants={{
            rest: { scale: 1 },
            hover: { scale: 1 },
            tap: { scale: 0.94 },
            powered: reduceMotion
              ? { scale: 1 }
              : {
                  scale: 1,
                  transition: { type: "spring", stiffness: 600, damping: 12 },
                },
          }}
          transition={SPRING}
        >
          {children}
        </motion.span>
      </motion.button>
    );
  },
);

ClickPowerUp.displayName = "ClickPowerUp";
