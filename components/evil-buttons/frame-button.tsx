"use client";

import * as React from "react";
import type { ComponentPropsWithoutRef } from "react";
import { motion, type Variants } from "motion/react";
import Link from "next/link";
import type { Route } from "next";
import type { UrlObject } from "url";
import { cn } from "@/lib/utils";

type ButtonVariant = "default" | "secondary" | "outline";
type Href = Route | UrlObject;

const MotionLink = motion.create(Link);

type BaseProps = {
  children: React.ReactNode;
  variant?: ButtonVariant;
  className?: string;
  /** Soft glow that blooms behind the button on hover. */
  glow?: boolean;
  /** Corner marker size: px as a number, or a Tailwind size class like `"size-4"`. */
  size?: number | string;
  /** Distance in px the markers sit outside the button's edge. */
  offset?: number;
  /** How far in px the markers spread out on hover. */
  hoverOffset?: number;
};

type ButtonProps = BaseProps &
  Omit<ComponentPropsWithoutRef<typeof motion.button>, "children"> & {
    as?: "button";
    href?: never;
  };

type AnchorProps = BaseProps &
  Omit<ComponentPropsWithoutRef<typeof motion.a>, "href" | "children"> & {
    as: "link";
    href: Href;
  };

export type FrameButtonProps = ButtonProps | AnchorProps;

const VARIANTS: Record<ButtonVariant, string> = {
  default: "border-foreground bg-foreground text-background",
  secondary:
    "border-border bg-secondary text-secondary-foreground hover:border-foreground hover:bg-foreground hover:text-background",
  outline: "border-border bg-transparent text-foreground hover:bg-foreground/5",
};

const SPRING = { type: "spring", stiffness: 380, damping: 24 } as const;

// Diagonal light band that sweeps across the face on hover.
const sweepVariants: Variants = {
  rest: { x: "-120%", transition: { duration: 0 } },
  hover: { x: "320%", transition: { duration: 0.9, ease: [0.4, 0, 0.2, 1] } },
  tap: { x: "320%" },
};

const glowVariants: Variants = {
  rest: { opacity: 0, scale: 0.9 },
  hover: { opacity: 0.35, scale: 1.08 },
  tap: { opacity: 0.5, scale: 1 },
};

export function FrameButton({
  children,
  className,
  variant = "default",
  glow = false,
  size = 14,
  offset = 6,
  hoverOffset = 5,
  ...props
}: FrameButtonProps) {
  const classes = cn(
    "group/frame relative inline-flex cursor-pointer items-center justify-center border px-8 py-3.5 text-xs font-medium tracking-[0.22em] uppercase no-underline outline-none select-none transition-colors duration-300",
    "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50",
    VARIANTS[variant],
    className,
  );

  const content = (
    <>
      {glow ? (
        <motion.span
          aria-hidden
          variants={glowVariants}
          transition={SPRING}
          className="pointer-events-none absolute inset-0 -z-10 bg-foreground blur-2xl"
        />
      ) : null}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        <motion.span
          variants={sweepVariants}
          className="absolute inset-y-0 left-0 w-1/3 -skew-x-12 bg-linear-to-r from-transparent via-current/15 to-transparent"
        />
      </span>
      <span className="relative inline-flex items-center gap-2">
        {children}
      </span>
      <FrameMarkers size={size} offset={offset} hoverOffset={hoverOffset} />
    </>
  );

  const motionProps = {
    initial: "rest",
    animate: "rest",
    whileHover: "hover",
    whileTap: "tap",
    whileFocus: "hover",
  } as const;

  if (props.as === "link") {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { as, href, ...anchorProps } = props;
    return (
      <MotionLink
        href={href}
        className={classes}
        {...motionProps}
        {...anchorProps}
      >
        {content}
      </MotionLink>
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { as, type = "button", ...buttonProps } = props;
  return (
    <motion.button
      type={type}
      className={classes}
      {...motionProps}
      {...buttonProps}
    >
      {content}
    </motion.button>
  );
}

interface FrameMarkersProps {
  className?: string;
  size?: number | string;
  offset?: number;
  hoverOffset?: number;
}

const MARKERS = [
  { key: "tl", x: -1, y: -1, className: "border-t-[1.5px] border-l-[1.5px]" },
  { key: "tr", x: 1, y: -1, className: "border-t-[1.5px] border-r-[1.5px]" },
  { key: "bl", x: -1, y: 1, className: "border-b-[1.5px] border-l-[1.5px]" },
  { key: "br", x: 1, y: 1, className: "border-b-[1.5px] border-r-[1.5px]" },
] as const;

const markerVariants: Variants = {
  rest: { x: 0, y: 0 },
  hover: ({ x, y, spread }: { x: number; y: number; spread: number }) => ({
    x: x * spread,
    y: y * spread,
  }),
  // Lock on: snap in tight against the button's edge.
  tap: ({ x, y, offset }: { x: number; y: number; offset: number }) => ({
    x: -x * (offset - 1),
    y: -y * (offset - 1),
  }),
};

/**
 * Four corner brackets around the nearest `motion` parent. They follow its
 * `rest` / `hover` / `tap` variants, so the parent needs those states set.
 */
export function FrameMarkers({
  className,
  size = 14,
  offset = 6,
  hoverOffset = 5,
}: FrameMarkersProps) {
  const sizeClass = typeof size === "string" ? size : undefined;
  const sizeStyle =
    typeof size === "number" ? { width: size, height: size } : {};

  return (
    <>
      {MARKERS.map((marker) => (
        <motion.span
          key={marker.key}
          aria-hidden
          custom={{ x: marker.x, y: marker.y, spread: hoverOffset, offset }}
          variants={markerVariants}
          transition={SPRING}
          className={cn(
            "pointer-events-none absolute border-foreground/35 transition-colors duration-300 group-hover/frame:border-foreground group-focus-visible/frame:border-foreground",
            marker.className,
            sizeClass,
            className,
          )}
          style={{
            ...sizeStyle,
            [marker.y < 0 ? "top" : "bottom"]: -offset,
            [marker.x < 0 ? "left" : "right"]: -offset,
          }}
        />
      ))}
    </>
  );
}
