"use client";

import * as React from "react";
import {
  AnimatePresence,
  animate,
  motion,
  useMotionTemplate,
  useMotionValue,
  useReducedMotion,
} from "motion/react";
import { cn } from "@/lib/utils";

type CooldownState = "idle" | "cooldown";

export type CooldownButtonVariant = "auto" | "dark" | "light";

// Graded surfaces matching MinimalButton: outer hairline, inner ring or top highlight, soft drop.
// Tailwind only sees literal class names, so the `dark:` half of "auto" is spelled out in full.
const surfaces: Record<
  CooldownButtonVariant,
  { base: string; cooling: string; sweep: string }
> = {
  dark: {
    base: "text-neutral-50 bg-linear-to-b from-[#353535] to-[#272727] shadow-[0_0_0_1px_rgb(0_0_0/0.9),inset_0_0_0_1px_rgb(255_255_255/0.06),inset_0_1px_0_rgb(255_255_255/0.14),0_1px_2px_rgb(0_0_0/0.25),0_4px_12px_-4px_rgb(0_0_0/0.4)] active:shadow-[0_0_0_1px_rgb(0_0_0/0.9),inset_0_0_0_1px_rgb(255_255_255/0.05),inset_0_1px_0_rgb(255_255_255/0.08),0_0_1px_rgb(0_0_0/0.2),0_1px_3px_-2px_rgb(0_0_0/0.3)]",
    cooling: "text-neutral-50/55",
    sweep: "opacity-[0.12]",
  },
  light: {
    base: "text-neutral-900 bg-linear-to-b from-white to-neutral-100 shadow-[0_0_0_1px_rgb(0_0_0/0.1),inset_0_1px_0_rgb(255_255_255/0.9),0_1px_2px_rgb(0_0_0/0.06),0_4px_12px_-4px_rgb(0_0_0/0.14)] active:shadow-[0_0_0_1px_rgb(0_0_0/0.12),inset_0_1px_0_rgb(255_255_255/0.6),0_0_1px_rgb(0_0_0/0.05),0_1px_3px_-2px_rgb(0_0_0/0.12)]",
    cooling: "text-neutral-900/55",
    sweep: "opacity-[0.16]",
  },
  auto: {
    base: "text-foreground bg-linear-to-b from-background to-muted shadow-[0_0_0_1px_rgb(0_0_0/0.1),inset_0_1px_0_rgb(255_255_255/0.9),0_1px_2px_rgb(0_0_0/0.06),0_4px_12px_-4px_rgb(0_0_0/0.14)] active:shadow-[0_0_0_1px_rgb(0_0_0/0.12),inset_0_1px_0_rgb(255_255_255/0.6),0_0_1px_rgb(0_0_0/0.05),0_1px_3px_-2px_rgb(0_0_0/0.12)] dark:text-neutral-50 dark:from-[#353535] dark:to-[#272727] dark:shadow-[0_0_0_1px_rgb(0_0_0/0.9),inset_0_0_0_1px_rgb(255_255_255/0.06),inset_0_1px_0_rgb(255_255_255/0.14),0_1px_2px_rgb(0_0_0/0.25),0_4px_12px_-4px_rgb(0_0_0/0.4)] dark:active:shadow-[0_0_0_1px_rgb(0_0_0/0.9),inset_0_0_0_1px_rgb(255_255_255/0.05),inset_0_1px_0_rgb(255_255_255/0.08),0_0_1px_rgb(0_0_0/0.2),0_1px_3px_-2px_rgb(0_0_0/0.3)]",
    cooling: "text-foreground/55 dark:text-neutral-50/55",
    sweep: "opacity-[0.16] dark:opacity-[0.12]",
  },
};

export interface CooldownButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Idle label. Falls back to `label`. */
  children?: React.ReactNode;
  /** Idle label used when no children are provided. */
  label?: React.ReactNode;
  /** Cooldown duration in milliseconds after each click. */
  cooldown?: number;
  /** Rotating taunts shown while locked. One is picked per cooldown. */
  taunts?: string[];
  /**
   * When true, the remaining seconds are appended to the taunt while locked.
   * @default true
   */
  showCountdown?: boolean;
  /**
   * Milliseconds the button starts already locked for, as if it was just clicked.
   * Useful for a "Resend code" button right after a code went out, or to resume a
   * persisted rate limit. The sweep starts drained by the share of `cooldown`
   * that has already passed. Read on mount only.
   * @default 0
   */
  initialCooldown?: number;
  /**
   * Surface style. `"auto"` is light and switches to the dark graphite face under
   * a `.dark` ancestor; `"dark"` and `"light"` force one face.
   * @default "auto"
   */
  variant?: CooldownButtonVariant;
}

const DEFAULT_TAUNTS = [
  "Patience.",
  "Again? Wait.",
  "Not so fast.",
  "Cool it.",
  "Hold your horses.",
];

export const CooldownButton = React.forwardRef<
  HTMLButtonElement,
  CooldownButtonProps
>(
  (
    {
      children,
      label = "Send it",
      cooldown = 3000,
      taunts = DEFAULT_TAUNTS,
      showCountdown = true,
      initialCooldown = 0,
      variant = "auto",
      onClick,
      className,
      disabled,
      ...props
    },
    ref,
  ) => {
    const reduceMotion = useReducedMotion();

    const startsLocked = initialCooldown > 0;
    const [state, setState] = React.useState<CooldownState>(
      startsLocked ? "cooldown" : "idle",
    );
    // A fixed first taunt keeps a pre-locked button identical on server and client.
    const [taunt, setTaunt] = React.useState(
      startsLocked ? (taunts[0] ?? "") : "",
    );
    const [remaining, setRemaining] = React.useState(
      startsLocked ? Math.ceil(initialCooldown / 1000) : 0,
    );

    const timeoutRef = React.useRef<number | null>(null);
    const intervalRef = React.useRef<number | null>(null);

    // Share of the full cooldown still left, as degrees of the sweep.
    const degreesLeft = React.useCallback(
      (left: number) =>
        cooldown > 0 ? Math.min(360, (360 * Math.max(0, left)) / cooldown) : 360,
      [cooldown],
    );

    // Drains toward 0 over the cooldown, painted as a conic sweep.
    const sweep = useMotionValue(
      startsLocked ? degreesLeft(initialCooldown) : 360,
    );
    const sweepBackground = useMotionTemplate`conic-gradient(currentColor ${sweep}deg, transparent 0deg)`;

    const clearTimers = React.useCallback(() => {
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      if (intervalRef.current !== null) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }, []);

    // Runs the lock for `duration` ms: countdown, sweep, then back to idle.
    const runCooldown = React.useCallback(
      (duration: number) => {
        clearTimers();
        sweep.set(degreesLeft(duration));
        if (!reduceMotion) {
          animate(sweep, 0, { duration: duration / 1000, ease: "linear" });
        }
        const end = performance.now() + duration;
        intervalRef.current = window.setInterval(() => {
          const left = end - performance.now();
          const seconds = Math.max(0, Math.ceil(left / 1000));
          setRemaining(seconds);
          // Reduced motion: the sweep ticks once a second with the countdown instead of gliding.
          if (reduceMotion) sweep.set(degreesLeft(seconds * 1000));
        }, 200);
        timeoutRef.current = window.setTimeout(() => {
          clearTimers();
          setState("idle");
        }, duration);
      },
      [clearTimers, degreesLeft, reduceMotion, sweep],
    );

    // Start the timers for a button that mounts already locked.
    const initialRef = React.useRef(initialCooldown);
    const runCooldownRef = React.useRef(runCooldown);
    React.useEffect(() => {
      runCooldownRef.current = runCooldown;
    }, [runCooldown]);
    React.useEffect(() => {
      if (initialRef.current > 0) runCooldownRef.current(initialRef.current);
    }, []);

    React.useEffect(() => () => clearTimers(), [clearTimers]);

    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      if (state === "cooldown") return;
      onClick?.(e);
      if (e.defaultPrevented || cooldown <= 0) return;

      const pick =
        taunts.length > 0
          ? taunts[Math.floor(Math.random() * taunts.length)]
          : "";
      setTaunt(pick);
      setRemaining(Math.ceil(cooldown / 1000));
      setState("cooldown");
      runCooldown(cooldown);
    };

    const isCooling = state === "cooldown";
    const surface = surfaces[variant];
    const idleLabel = children ?? label;
    const cooldownLabel =
      showCountdown && remaining > 0 ? `${taunt} ${remaining}s` : taunt;

    return (
      <button
        ref={ref}
        type="button"
        onClick={handleClick}
        disabled={disabled || isCooling}
        aria-live="polite"
        data-state={state}
        className={cn(
          "relative inline-flex h-9 min-w-40 cursor-pointer items-center justify-center overflow-hidden rounded-[10px] px-4 text-sm font-medium outline-none select-none",
          // Graded surface; the press also settles the shadow (see `surfaces`).
          surface.base,
          "transition-[scale,filter,box-shadow,color] duration-300 ease-[cubic-bezier(0.34,1.35,0.64,1)] hover:brightness-110",
          "active:scale-[0.97] active:brightness-95 active:duration-100 active:ease-out motion-reduce:active:scale-100",
          "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50",
          // Locked by the cooldown, not disabled: stay solid, dim the label, no hover lift.
          isCooling &&
            cn(surface.cooling, "hover:brightness-100 disabled:opacity-100"),
          className,
        )}
        {...props}
      >
        {/* Radial sweep that drains over the cooldown duration. */}
        {isCooling && (
          <motion.span
            aria-hidden
            className={cn(
              "pointer-events-none absolute inset-0 z-0",
              surface.sweep,
            )}
            style={{ background: sweepBackground }}
          />
        )}

        <span className="relative z-10 inline-block">
          <AnimatePresence initial={false} mode="wait">
            <motion.span
              key={isCooling ? `cool-${taunt}` : "idle"}
              initial={reduceMotion ? false : { y: 8, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={reduceMotion ? undefined : { y: -8, opacity: 0 }}
              transition={{ duration: 0.16 }}
              className="inline-block whitespace-nowrap"
            >
              {isCooling ? cooldownLabel : idleLabel}
            </motion.span>
          </AnimatePresence>
        </span>
      </button>
    );
  },
);

CooldownButton.displayName = "CooldownButton";

export default CooldownButton;
