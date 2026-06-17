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
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type CooldownState = "idle" | "cooldown";

export interface CooldownButtonProps
  extends React.ComponentProps<typeof Button> {
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
      variant = "outline",
      size = "lg",
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
      <Button
        ref={ref}
        type="button"
        variant={variant}
        size={size}
        onClick={handleClick}
        disabled={disabled || isCooling}
        aria-live="polite"
        data-state={state}
        className={cn(
          "relative min-w-40 overflow-hidden rounded-md px-4 font-semibold",
          isCooling && "text-muted-foreground",
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
      </Button>
    );
  },
);

CooldownButton.displayName = "CooldownButton";

export default CooldownButton;
