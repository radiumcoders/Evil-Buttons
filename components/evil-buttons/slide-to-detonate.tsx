"use client";

import * as React from "react";
import {
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
  type AnimationPlaybackControls,
  type Transition,
} from "motion/react";
import { cn } from "@/lib/utils";

type SlideState = "idle" | "sliding" | "success";

export interface SlideToDetonateProps
  extends Omit<
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    | "onClick"
    | "onDrag"
    | "onDragStart"
    | "onDragEnd"
    | "onAnimationStart"
    | "style"
  > {
  /** Track label shown while idle. Falls back to `label`. */
  children?: React.ReactNode;
  /** Idle label used when no children are provided. */
  label?: React.ReactNode;
  /** Label shown once the slide reaches the end and the action fires. */
  successLabel?: React.ReactNode;
  /** Fired once the handle is released past the threshold. */
  onConfirm?: () => void;
  /**
   * Fraction of the track (0-1) the handle must cross to arm the action.
   * @default 0.9
   */
  threshold?: number;
  /** Milliseconds to stay in the success state before resetting. Set to 0 to stay. */
  resetAfter?: number;
  /**
   * How hard the fuse pushes back (0-1). At 0 the handle tracks the pointer
   * one to one; higher values make it lag further behind the pointer the
   * closer it gets to the end, though it still reaches the end.
   * @default 0.35
   */
  resistance?: number;
  /**
   * How softly the handle follows the pointer (0-1). At 0 it is locked to the
   * pointer; higher values let it glide behind on a spring.
   * @default 0.4
   */
  smoothness?: number;
}

const HANDLE = 40;
const TRACK_PADDING = 4;
/** Keyboard step as a fraction of the track. */
const KEY_STEP = 0.1;
/** Farthest in px the handle stretches when pulled back past the start. */
const PULL_BACK = 10;

const SNAP_BACK: Transition = { type: "spring", stiffness: 520, damping: 34, mass: 0.7 };
const SNAP_END: Transition = { type: "spring", stiffness: 700, damping: 40 };

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

/** Pointer travel (0-1) to handle travel (0-1); resistance bends the curve so the end is heavier. */
function resist(t: number, resistance: number) {
  return Math.pow(t, 1 + resistance * 1.5);
}

function unresist(t: number, resistance: number) {
  return Math.pow(t, 1 / (1 + resistance * 1.5));
}

/** Spring that follows the pointer: stiff and critically damped at 0, loose and floaty at 1. */
function followSpring(smoothness: number): Transition {
  const s = clamp01(smoothness);
  return {
    type: "spring",
    stiffness: 1400 - s * 1220,
    damping: 70 - s * 46,
    mass: 0.4 + s * 0.4,
  };
}

const ChevronsIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="size-4"
    aria-hidden
  >
    <path d="m6 17 5-5-5-5" />
    <path d="m13 17 5-5-5-5" />
  </svg>
);

const CheckIcon = ({ className }: { className?: string }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.25"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={cn("size-4", className)}
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
      threshold = 0.9,
      resetAfter = 1600,
      resistance = 0.35,
      smoothness = 0.4,
      className,
      disabled,
      onPointerDown,
      onKeyDown,
      onBlur,
      ...props
    },
    ref,
  ) => {
    const reduceMotion = useReducedMotion();

    const trackRef = React.useRef<HTMLDivElement | null>(null);
    const resetTimeoutRef = React.useRef<number | null>(null);
    const controlsRef = React.useRef<AnimationPlaybackControls | null>(null);
    // Pointer x at which the handle would sit at the start of the track.
    const originRef = React.useRef(0);
    const armedRef = React.useRef(false);
    const draggingRef = React.useRef(false);

    const [state, setState] = React.useState<SlideState>("idle");
    const [armed, setArmed] = React.useState(false);
    const [range, setRange] = React.useState(0);
    const [percent, setPercent] = React.useState(0);

    const x = useMotionValue(0);
    const progress = useTransform(() => (range > 0 ? clamp01(x.get() / range) : 0));
    const labelOpacity = useTransform(progress, [0, 0.6], [1, 0]);
    const trailWidth = useTransform(() => Math.max(0, x.get()) + HANDLE);
    const trailOpacity = useTransform(progress, [0, 0.15, 1], [0, 0.55, 1]);

    const safeThreshold = clamp01(threshold);
    const isSuccess = state === "success";
    const locked = disabled || isSuccess;
    const labelText = children ?? label;

    const measure = React.useCallback(() => {
      const node = trackRef.current;
      if (!node) return;
      setRange(Math.max(0, node.clientWidth - HANDLE - TRACK_PADDING * 2));
    }, []);

    React.useEffect(() => {
      measure();
      const node = trackRef.current;
      if (!node || typeof ResizeObserver === "undefined") return;
      const observer = new ResizeObserver(measure);
      observer.observe(node);
      return () => observer.disconnect();
    }, [measure]);

    React.useEffect(
      () => () => {
        controlsRef.current?.stop();
        if (resetTimeoutRef.current !== null) {
          window.clearTimeout(resetTimeoutRef.current);
        }
      },
      [],
    );

    // Mirror progress into a coarse percentage for aria-valuenow without re-rendering every frame.
    React.useEffect(
      () =>
        progress.on("change", (value) => {
          setPercent((current) => {
            const next = Math.round(value * 100);
            return current === next ? current : next;
          });
        }),
      [progress],
    );

    const moveTo = (to: number, transition: Transition | null) => {
      controlsRef.current?.stop();
      if (!transition || reduceMotion) {
        x.set(to);
        return;
      }
      controlsRef.current = animate(x, to, transition);
    };

    const setArmedState = (next: boolean) => {
      if (armedRef.current === next) return;
      armedRef.current = next;
      setArmed(next);
      // A tiny tick on phones when the fuse arms.
      if (next) navigator.vibrate?.(8);
    };

    const fire = () => {
      setArmedState(false);
      setState("success");
      moveTo(range, SNAP_END);
      onConfirm?.();
      if (resetAfter > 0) {
        resetTimeoutRef.current = window.setTimeout(() => {
          resetTimeoutRef.current = null;
          setState("idle");
          moveTo(0, SNAP_BACK);
        }, resetAfter);
      }
    };

    const release = () => {
      if (armedRef.current) {
        fire();
      } else {
        setState("idle");
        moveTo(0, SNAP_BACK);
      }
    };

    const handlePointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
      onPointerDown?.(event);
      if (locked || range <= 0 || event.defaultPrevented) return;
      if (event.pointerType === "mouse" && event.button !== 0) return;

      event.currentTarget.setPointerCapture(event.pointerId);
      // Start from wherever the handle currently is, mapped back into pointer space.
      const current = clamp01(x.get() / range);
      originRef.current = event.clientX - unresist(current, resistance) * range;
      draggingRef.current = true;
      setState("sliding");
    };

    const handlePointerMove = (event: React.PointerEvent<HTMLButtonElement>) => {
      if (!draggingRef.current || range <= 0) return;

      const raw = event.clientX - originRef.current;
      let next: number;
      if (raw < 0) {
        // Rubber-band a little when pulled back past the start.
        next = -PULL_BACK * (1 - 1 / (1 + -raw / 60));
      } else {
        next = resist(clamp01(raw / range), resistance) * range;
      }

      moveTo(next, smoothness > 0 ? followSpring(smoothness) : null);
      setArmedState(next / range >= safeThreshold);
    };

    const handlePointerEnd = () => {
      if (!draggingRef.current) return;
      draggingRef.current = false;
      release();
    };

    const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
      onKeyDown?.(event);
      if (locked || range <= 0 || event.defaultPrevented) return;

      const current = clamp01(x.get() / range);
      let next: number | null = null;
      if (event.key === "ArrowRight" || event.key === "ArrowUp") next = current + KEY_STEP;
      else if (event.key === "ArrowLeft" || event.key === "ArrowDown") next = current - KEY_STEP;
      else if (event.key === "Home") next = 0;
      else if (event.key === "End") next = 1;
      if (next === null) return;

      event.preventDefault();
      next = clamp01(next);
      if (next >= safeThreshold) {
        fire();
        return;
      }
      setState(next > 0 ? "sliding" : "idle");
      moveTo(next * range, followSpring(smoothness));
    };

    const handleBlur = (event: React.FocusEvent<HTMLButtonElement>) => {
      onBlur?.(event);
      // Keyboard progress doesn't linger once focus leaves.
      if (!isSuccess && x.get() !== 0) {
        setArmedState(false);
        setState("idle");
        moveTo(0, SNAP_BACK);
      }
    };

    return (
      <div
        ref={trackRef}
        data-state={state}
        data-armed={armed || undefined}
        className={cn(
          "group/slide relative inline-flex h-12 min-w-72 items-center overflow-hidden rounded-full select-none",
          // Recessed track: dark hairline, faint inner ring, soft inner shadow from the top.
          "bg-[#1c1c1c] shadow-[0_0_0_1px_rgb(0_0_0/0.9),inset_0_0_0_1px_rgb(255_255_255/0.05),inset_0_2px_6px_rgb(0_0_0/0.5),0_1px_0_rgb(255_255_255/0.04)]",
          disabled && "cursor-not-allowed opacity-50",
          className,
        )}
      >
        {/* Ember trail that fills in behind the handle. */}
        <motion.span
          aria-hidden
          className={cn(
            "pointer-events-none absolute top-1 bottom-1 left-1 rounded-full transition-[filter] duration-300",
            "bg-linear-to-r from-red-950/0 via-red-800/45 to-orange-500/60",
            "group-data-armed/slide:brightness-125 group-data-[state=success]/slide:brightness-125",
          )}
          style={{ width: trailWidth, opacity: trailOpacity }}
        />

        {/* Idle / success label centered on the track. */}
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center gap-2 pl-10 text-sm font-medium">
          {isSuccess ? (
            <motion.span
              key="success"
              initial={reduceMotion ? false : { opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className="inline-flex items-center gap-1.5 text-neutral-50"
            >
              <CheckIcon className="size-3.5" />
              {successLabel}
            </motion.span>
          ) : (
            <motion.span
              key="idle"
              style={{
                opacity: labelOpacity,
                backgroundImage:
                  "linear-gradient(90deg, rgb(250 250 250 / 0.4) 0%, rgb(250 250 250 / 0.4) 40%, rgb(250 250 250 / 0.95) 50%, rgb(250 250 250 / 0.4) 60%, rgb(250 250 250 / 0.4) 100%)",
                backgroundSize: "250% 100%",
              }}
              // A slow shimmer sweeping toward the end, like "slide to unlock".
              animate={
                reduceMotion || disabled
                  ? { backgroundPosition: "50% 0" }
                  : { backgroundPosition: ["100% 0", "0% 0"] }
              }
              transition={{ duration: 2.6, ease: "linear", repeat: Infinity }}
              className="bg-clip-text text-transparent"
            >
              {labelText}
            </motion.span>
          )}
        </span>

        {/* Draggable handle. */}
        <motion.button
          ref={ref}
          type="button"
          role="slider"
          aria-label={typeof labelText === "string" ? labelText : "Slide to confirm"}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={isSuccess ? 100 : percent}
          aria-valuetext={isSuccess ? "Confirmed" : `${percent}%`}
          disabled={disabled}
          data-state={state}
          data-armed={armed || undefined}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerEnd}
          onPointerCancel={handlePointerEnd}
          onLostPointerCapture={handlePointerEnd}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          style={{ x }}
          className={cn(
            "absolute top-1 left-1 z-10 inline-flex size-10 touch-none items-center justify-center rounded-full text-neutral-50/70 outline-none",
            // Raised handle: graded dark surface, hairline ring, top highlight, soft drop.
            "bg-linear-to-b from-[#3a3a3a] to-[#2a2a2a] shadow-[0_0_0_1px_rgb(0_0_0/0.9),inset_0_0_0_1px_rgb(255_255_255/0.06),inset_0_1px_0_rgb(255_255_255/0.16),0_1px_2px_rgb(0_0_0/0.3),0_4px_10px_-2px_rgb(0_0_0/0.5)]",
            "transition-[color,filter,box-shadow] duration-200 hover:brightness-110",
            // Armed: the handle picks up the ember glow of the trail.
            "data-armed:text-orange-200 data-armed:shadow-[0_0_0_1px_rgb(0_0_0/0.9),inset_0_0_0_1px_rgb(251_146_60/0.35),inset_0_1px_0_rgb(255_255_255/0.16),0_1px_2px_rgb(0_0_0/0.3),0_0_16px_-2px_rgb(249_115_22/0.6)]",
            "data-[state=success]:text-neutral-50",
            "focus-visible:ring-2 focus-visible:ring-orange-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#1c1c1c]",
            locked ? "cursor-default" : "cursor-grab data-[state=sliding]:cursor-grabbing",
            disabled && "cursor-not-allowed",
          )}
          {...props}
        >
          {isSuccess ? <CheckIcon /> : <ChevronsIcon />}
        </motion.button>
      </div>
    );
  },
);

SlideToDetonate.displayName = "SlideToDetonate";

export default SlideToDetonate;
