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
      onClick,
      className,
      disabled,
      ...props
    },
    ref,
  ) => {
    const reduceMotion = useReducedMotion();

    const [state, setState] = React.useState<CooldownState>("idle");
    const [taunt, setTaunt] = React.useState("");
    const [remaining, setRemaining] = React.useState(0);

    const timeoutRef = React.useRef<number | null>(null);
    const intervalRef = React.useRef<number | null>(null);

    // Drains 360 -> 0 over the cooldown, painted as a conic sweep.
    const sweep = useMotionValue(360);
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

      clearTimers();
      sweep.set(360);
      if (!reduceMotion) {
        animate(sweep, 0, { duration: cooldown / 1000, ease: "linear" });
      }
      const end = performance.now() + cooldown;
      intervalRef.current = window.setInterval(() => {
        setRemaining(Math.max(0, Math.ceil((end - performance.now()) / 1000)));
      }, 200);
      timeoutRef.current = window.setTimeout(() => {
        clearTimers();
        setState("idle");
      }, cooldown);
    };

    const isCooling = state === "cooldown";
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
          "relative inline-flex h-9 min-w-40 cursor-pointer items-center justify-center overflow-hidden rounded-[10px] px-4 text-sm font-medium text-neutral-50 outline-none select-none",
          // Graded dark surface matching MinimalButton: dark outer hairline, faint inner ring, top highlight, soft drop.
          "bg-linear-to-b from-[#353535] to-[#272727] shadow-[0_0_0_1px_rgb(0_0_0/0.9),inset_0_0_0_1px_rgb(255_255_255/0.06),inset_0_1px_0_rgb(255_255_255/0.14),0_1px_2px_rgb(0_0_0/0.25),0_4px_12px_-4px_rgb(0_0_0/0.4)]",
          "transition-[scale,filter,box-shadow,color] duration-300 ease-[cubic-bezier(0.34,1.35,0.64,1)] hover:brightness-110",
          "active:scale-[0.97] active:brightness-95 active:duration-100 active:ease-out active:shadow-[0_0_0_1px_rgb(0_0_0/0.9),inset_0_0_0_1px_rgb(255_255_255/0.05),inset_0_1px_0_rgb(255_255_255/0.08),0_0_1px_rgb(0_0_0/0.2),0_1px_3px_-2px_rgb(0_0_0/0.3)] motion-reduce:active:scale-100",
          "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50",
          // Locked by the cooldown, not disabled: stay solid, dim the label, no hover lift.
          isCooling && "text-neutral-50/55 hover:brightness-100 disabled:opacity-100",
          className,
        )}
        {...props}
      >
        {/* Radial sweep that drains over the cooldown duration. */}
        {isCooling && (
          <motion.span
            aria-hidden
            className="pointer-events-none absolute inset-0 z-0 opacity-[0.12]"
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
