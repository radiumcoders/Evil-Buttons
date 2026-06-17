"use client";

import * as React from "react";
import {
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from "motion/react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type SlideState = "idle" | "sliding" | "success";

const MotionButton = motion.create(Button);

export interface SlideToDetonateProps
  extends Omit<
    React.ComponentProps<typeof Button>,
    "onClick" | "onDrag" | "onDragStart" | "onDragEnd" | "onAnimationStart" | "style"
  > {
  /** Track label shown while idle. Falls back to `label`. */
  children?: React.ReactNode;
  /** Idle label used when no children are provided. */
  label?: React.ReactNode;
  /** Label flashed once the slide reaches the end and the action fires. */
  successLabel?: React.ReactNode;
  /** Fired once the handle is dragged past the threshold. */
  onConfirm?: () => void;
  /**
   * Fraction of the track (0-1) the handle must cross to arm the action.
   * @default 0.95
   */
  threshold?: number;
  /** Milliseconds to stay in the success state before resetting. Set to 0 to stay. */
  resetAfter?: number;
}

const HANDLE = 40;
const TRACK_PADDING = 4;

const ChevronsIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.25"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="size-5"
    aria-hidden
  >
    <path d="m6 17 5-5-5-5" />
    <path d="m13 17 5-5-5-5" />
  </svg>
);

const CheckIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.25"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="size-5"
    aria-hidden
  >
    <path d="M20 6 9 17l-5-5" />
  </svg>
);

export const SlideToDetonate = React.forwardRef<
  HTMLButtonElement,
  SlideToDetonateProps
>(
  (
    {
      children,
      label = "Slide to detonate",
      successLabel = "Detonated",
      onConfirm,
      threshold = 0.95,
      resetAfter = 1600,
      variant = "default",
      className,
      disabled,
      ...props
    },
    ref,
  ) => {
    const reduceMotion = useReducedMotion();

    const trackRef = React.useRef<HTMLDivElement | null>(null);
    const resetTimeoutRef = React.useRef<number | null>(null);

    const [state, setState] = React.useState<SlideState>("idle");
    const [range, setRange] = React.useState(0);

    const x = useMotionValue(0);
    // 0 (start) -> 1 (armed); drives the label fade.
    const progress = useTransform(() => (range > 0 ? x.get() / range : 0));
    const labelOpacity = useTransform(progress, [0, 0.7], [1, 0]);

    const measure = React.useCallback(() => {
      const node = trackRef.current;
      if (!node) return;
      setRange(node.clientWidth - HANDLE - TRACK_PADDING * 2);
    }, []);

    React.useEffect(() => {
      measure();
      const node = trackRef.current;
      if (!node || typeof ResizeObserver === "undefined") return;
      const observer = new ResizeObserver(() => measure());
      observer.observe(node);
      return () => observer.disconnect();
    }, [measure]);

    React.useEffect(() => {
      return () => {
        if (resetTimeoutRef.current !== null) {
          window.clearTimeout(resetTimeoutRef.current);
        }
      };
    }, []);

    const settle = (to: number) => {
      if (reduceMotion) {
        x.set(to);
        return;
      }
      animate(x, to, { type: "spring", stiffness: 500, damping: 38 });
    };

    const fire = () => {
      setState("success");
      x.set(range);
      onConfirm?.();
      if (resetAfter > 0) {
        resetTimeoutRef.current = window.setTimeout(() => {
          setState("idle");
          settle(0);
        }, resetAfter);
      }
    };

    const handleDragEnd = () => {
      if (state === "success") return;
      if (range > 0 && x.get() >= range * threshold) {
        fire();
      } else {
        setState("idle");
        settle(0);
      }
    };

    const isSuccess = state === "success";

    return (
      <div
        ref={trackRef}
        data-state={state}
        className={cn(
          "relative inline-flex h-12 min-w-72 select-none items-center overflow-hidden rounded-full border border-border bg-muted/60 shadow-sm transition-colors",
          disabled && "cursor-not-allowed opacity-50",
          className,
        )}
      >
        {/* Idle / success label centered on the track. */}
        <motion.span
          className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center gap-2 pl-8 text-sm font-semibold tracking-wide text-muted-foreground"
          style={isSuccess ? undefined : { opacity: labelOpacity }}
        >
          {isSuccess && <CheckIcon />}
          {isSuccess ? successLabel : (children ?? label)}
        </motion.span>

        {/* Draggable handle. */}
        <MotionButton
          ref={ref}
          type="button"
          variant={variant}
          size="icon"
          aria-label={
            typeof (children ?? label) === "string"
              ? String(children ?? label)
              : "Slide to confirm"
          }
          disabled={disabled}
          data-state={state}
          drag={disabled || isSuccess ? false : "x"}
          dragConstraints={{ left: 0, right: range }}
          dragElastic={0}
          dragMomentum={false}
          onDragStart={() => setState("sliding")}
          onDragEnd={handleDragEnd}
          style={{ x }}
          className={cn(
            // Override the Button base `transition-all` so dragging the handle
            // is not animated frame-by-frame (which makes it feel laggy).
            "absolute left-1 top-1 z-20 size-10 rounded-full shadow-md transition-colors",
            !isSuccess && "cursor-grab active:cursor-grabbing",
            disabled && "cursor-not-allowed",
          )}
          {...props}
        >
          {isSuccess ? <CheckIcon /> : <ChevronsIcon />}
        </MotionButton>
      </div>
    );
  },
);

SlideToDetonate.displayName = "SlideToDetonate";

export default SlideToDetonate;
