"use client";

import * as React from "react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";

export interface HighlightButtonProps extends Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  "onDrag" | "onDragStart" | "onDragEnd" | "onAnimationStart"
> {
  /** Surface style of the button. */
  variant?: "default" | "secondary" | "outline";
  /** Color of the cursor spotlight and click ripple. */
  highlightColor?: string;
  /** Radius in px of the cursor spotlight. */
  highlightSize?: number;
  /** Color the border lights up with near the cursor. */
  borderColor?: string;
}

type Ripple = { id: number; x: number; y: number; size: number };

const VARIANTS = {
  default:
    "border-transparent bg-primary text-primary-foreground hover:bg-primary/90 shadow-[0_1px_2px_rgb(0_0_0/0.14),0_2px_6px_-2px_rgb(0_0_0/0.12),inset_0_1px_0_rgb(255_255_255/0.14),inset_0_-1px_0_rgb(0_0_0/0.12)]",
  secondary:
    "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80 shadow-[0_1px_2px_rgb(0_0_0/0.05),0_2px_6px_-3px_rgb(0_0_0/0.07),inset_0_-1px_0_rgb(0_0_0/0.03)] dark:shadow-[0_1px_2px_rgb(0_0_0/0.4),inset_0_1px_0_rgb(255_255_255/0.05)]",
  outline: "border-border bg-background text-foreground hover:bg-accent/40 shadow-[0_1px_2px_rgb(0_0_0/0.05),0_2px_6px_-3px_rgb(0_0_0/0.07),inset_0_-1px_0_rgb(0_0_0/0.03)] dark:shadow-[0_1px_2px_rgb(0_0_0/0.4),inset_0_1px_0_rgb(255_255_255/0.05)]",
} as const;

// Paints only the 1px border ring: the content box is cut out of the full box.
const BORDER_MASK = {
  padding: 1,
  mask: "linear-gradient(#000 0 0) content-box exclude, linear-gradient(#000 0 0)",
  WebkitMask:
    "linear-gradient(#000 0 0) content-box xor, linear-gradient(#000 0 0)",
} satisfies React.CSSProperties;

export const HighlightButton = React.forwardRef<
  HTMLButtonElement,
  HighlightButtonProps
>(
  (
    {
      variant = "default",
      highlightColor = "color-mix(in oklab, currentColor 28%, transparent)",
      highlightSize = 90,
      borderColor = "color-mix(in oklab, currentColor 75%, transparent)",
      className,
      style,
      children,
      onPointerMove,
      onPointerDown,
      onClick,
      type = "button",
      ...props
    },
    ref,
  ) => {
    const buttonRef = React.useRef<HTMLButtonElement | null>(null);
    const rippleIdRef = React.useRef(0);
    const [ripples, setRipples] = React.useState<Ripple[]>([]);

    const setRefs = React.useCallback(
      (node: HTMLButtonElement | null) => {
        buttonRef.current = node;
        if (typeof ref === "function") ref(node);
        else if (ref) ref.current = node;
      },
      [ref],
    );

    /** Cursor position relative to the button, written to CSS vars without re-rendering. */
    const track = (clientX: number, clientY: number) => {
      const button = buttonRef.current;
      if (!button) return null;
      const rect = button.getBoundingClientRect();
      const x = clientX - rect.left;
      const y = clientY - rect.top;
      button.style.setProperty("--hl-x", `${x}px`);
      button.style.setProperty("--hl-y", `${y}px`);
      return { x, y, rect };
    };

    const addRipple = (x: number, y: number, rect: DOMRect) => {
      // Big enough to reach the farthest corner from where it starts.
      const size =
        2 *
        Math.hypot(Math.max(x, rect.width - x), Math.max(y, rect.height - y));
      const id = ++rippleIdRef.current;
      setRipples((current) => [...current, { id, x, y, size }]);
    };

    const handlePointerMove = (
      event: React.PointerEvent<HTMLButtonElement>,
    ) => {
      onPointerMove?.(event);
      track(event.clientX, event.clientY);
    };

    const handlePointerDown = (
      event: React.PointerEvent<HTMLButtonElement>,
    ) => {
      onPointerDown?.(event);
      const hit = track(event.clientX, event.clientY);
      if (hit) addRipple(hit.x, hit.y, hit.rect);
    };

    const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
      onClick?.(event);
      // Keyboard activation has no pointer, so ripple from the center.
      if (event.detail === 0 && buttonRef.current) {
        const rect = buttonRef.current.getBoundingClientRect();
        addRipple(rect.width / 2, rect.height / 2, rect);
      }
    };

    return (
      <motion.button
        ref={setRefs}
        type={type}
        whileTap={{ scale: 0.97 }}
        transition={{ type: "spring", stiffness: 500, damping: 30 }}
        onPointerMove={handlePointerMove}
        onPointerDown={handlePointerDown}
        onClick={handleClick}
        style={
          {
            "--hl-color": highlightColor,
            "--hl-border": borderColor,
            "--hl-size": `${highlightSize}px`,
            ...style,
          } as React.CSSProperties
        }
        className={cn(
          "group/highlight relative inline-flex h-9 cursor-pointer items-center justify-center rounded-md border px-4 text-sm font-medium whitespace-nowrap outline-none select-none transition-colors",
          "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50",
          VARIANTS[variant],
          className,
        )}
        {...props}
      >
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]"
        >
          {/* Soft spotlight under the cursor. */}
          <span
            className="absolute inset-0 opacity-0 transition-opacity duration-300 group-hover/highlight:opacity-100"
            style={{
              background:
                "radial-gradient(var(--hl-size) circle at var(--hl-x, 50%) var(--hl-y, 50%), var(--hl-color), transparent 70%)",
            }}
          />
          {ripples.map((ripple) => (
            <motion.span
              key={ripple.id}
              className="absolute rounded-full"
              style={{
                left: ripple.x - ripple.size / 2,
                top: ripple.y - ripple.size / 2,
                width: ripple.size,
                height: ripple.size,
                background: "var(--hl-color)",
              }}
              initial={{ scale: 0, opacity: 1 }}
              animate={{ scale: 1, opacity: 0 }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              onAnimationComplete={() =>
                setRipples((current) =>
                  current.filter(({ id }) => id !== ripple.id),
                )
              }
            />
          ))}
        </span>
        {/* Border that lights up near the cursor. */}
        <span
          aria-hidden
          className="pointer-events-none absolute -inset-px rounded-[inherit] opacity-0 transition-opacity duration-300 group-hover/highlight:opacity-100"
          style={{
            ...BORDER_MASK,
            background:
              "radial-gradient(calc(var(--hl-size) * 0.9) circle at var(--hl-x, 50%) var(--hl-y, 50%), var(--hl-border), transparent 75%)",
          }}
        />
        <span className="relative inline-flex items-center gap-1.5">
          {children}
        </span>
      </motion.button>
    );
  },
);

HighlightButton.displayName = "HighlightButton";
