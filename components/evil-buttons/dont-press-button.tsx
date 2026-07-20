"use client";

import * as React from "react";
import {
  AnimatePresence,
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
} from "motion/react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type DontPressState = "idle" | "tempted" | "succumbed";

export interface DontPressButtonProps
  extends Omit<React.ComponentProps<typeof Button>, "onClick" | "children"> {
  /** Idle label. Falls back to `idleLabel` when omitted. */
  children?: React.ReactNode;
  /** Label shown before temptation builds. */
  idleLabel?: React.ReactNode;
  /**
   * Escalating labels as hover/proximity temptation rises.
   * Index is picked from how close temptation is to 1.
   */
  temptLabels?: React.ReactNode[];
  /** Label flashed after the user gives in and clicks. */
  succumbLabel?: React.ReactNode;
  /** Fired when the user clicks despite every warning. */
  onSuccumb?: () => void;
  /** Milliseconds to stay in the succumb state before resetting. Set to 0 to stay. */
  resetAfter?: number;
}

const DEFAULT_TEMPT_LABELS: string[] = [
  "Don't…",
  "Really, don't",
  "Just one peek?",
  "Nobody's watching…",
  "Do it.",
];

export const DontPressButton = React.forwardRef<
  HTMLButtonElement,
  DontPressButtonProps
>(
  (
    {
      children,
      idleLabel = "Don't Press",
      temptLabels = DEFAULT_TEMPT_LABELS,
      succumbLabel = "You pressed it.",
      onSuccumb,
      resetAfter = 1600,
      className,
      disabled,
      variant,
      size,
      type = "button",
      ...props
    },
    ref,
  ) => {
    const buttonRef = React.useRef<HTMLButtonElement | null>(null);
    const resetTimerRef = React.useRef<number | null>(null);
    const preferReducedMotion = useReducedMotion();

    const [state, setState] = React.useState<DontPressState>("idle");
    const [temptation, setTemptation] = React.useState(0);

    const temptationMv = useMotionValue(0);
    const smoothTemptation = useSpring(temptationMv, {
      stiffness: 180,
      damping: 22,
      mass: 0.7,
    });

    const setButtonRef = (node: HTMLButtonElement | null) => {
      buttonRef.current = node;
      if (typeof ref === "function") ref(node);
      else if (ref) ref.current = node;
    };

    React.useEffect(() => {
      return () => {
        if (resetTimerRef.current !== null) {
          window.clearTimeout(resetTimerRef.current);
        }
      };
    }, []);

    React.useEffect(() => {
      const unsub = smoothTemptation.on("change", (value) => {
        setTemptation(value);
        if (state === "succumbed") return;
        setState(value > 0.08 ? "tempted" : "idle");
      });
      return unsub;
    }, [smoothTemptation, state]);

    React.useEffect(() => {
      if (preferReducedMotion || disabled || state === "succumbed") return;

      const handleMouseMove = (e: MouseEvent) => {
        const btn = buttonRef.current;
        if (!btn) return;

        const rect = btn.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const dx = e.clientX - centerX;
        const dy = e.clientY - centerY;
        const distance = Math.sqrt(dx * dx + dy * dy);

        // Build temptation as the cursor nears; hover is full temptation.
        const proximity = Math.max(0, 1 - distance / 140);
        const next = Math.min(1, proximity);
        temptationMv.set(Math.max(temptationMv.get() * 0.92, next));
      };

      document.addEventListener("mousemove", handleMouseMove);
      return () => document.removeEventListener("mousemove", handleMouseMove);
    }, [disabled, preferReducedMotion, state, temptationMv]);

    const temptIndex =
      temptLabels.length === 0
        ? 0
        : Math.min(
            temptLabels.length - 1,
            Math.floor(temptation * temptLabels.length),
          );

    const displayLabel =
      state === "succumbed"
        ? succumbLabel
        : state === "tempted"
          ? (temptLabels[temptIndex] ?? children ?? idleLabel)
          : (children ?? idleLabel);

    const handlePointerEnter = () => {
      if (disabled || state === "succumbed") return;
      temptationMv.set(1);
    };

    const handlePointerLeave = () => {
      if (disabled || state === "succumbed") return;
      temptationMv.set(0);
    };

    const handleClick = () => {
      if (disabled || state === "succumbed") return;

      setState("succumbed");
      temptationMv.set(1);
      onSuccumb?.();

      if (resetAfter > 0) {
        if (resetTimerRef.current !== null) {
          window.clearTimeout(resetTimerRef.current);
        }
        resetTimerRef.current = window.setTimeout(() => {
          setState("idle");
          temptationMv.set(0);
          resetTimerRef.current = null;
        }, resetAfter);
      }
    };

    const glow = preferReducedMotion
      ? "0 0 0px rgba(0,0,0,0)"
      : `0 0 ${8 + temptation * 28}px rgba(220, 38, 38, ${0.15 + temptation * 0.45})`;

    const scale = preferReducedMotion ? 1 : 1 + temptation * 0.1;

    return (
      <motion.span
        className="inline-flex"
        animate={{
          scale,
          boxShadow: glow,
        }}
        transition={
          preferReducedMotion
            ? { duration: 0 }
            : { type: "spring", stiffness: 320, damping: 22 }
        }
      >
        <Button
          ref={setButtonRef}
          type={type}
          size={size}
          disabled={disabled}
          variant={
            variant ??
            (state === "succumbed" || temptation > 0.55
              ? "default"
              : "destructive")
          }
          className={cn(
            "relative min-w-36 overflow-hidden font-medium",
            temptation > 0.4 && "ring-1 ring-destructive/40",
            className,
          )}
          {...props}
          onClick={handleClick}
          onPointerEnter={handlePointerEnter}
          onPointerLeave={handlePointerLeave}
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={String(displayLabel)}
              initial={
                preferReducedMotion
                  ? false
                  : { opacity: 0, y: 6, filter: "blur(4px)" }
              }
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={
                preferReducedMotion
                  ? undefined
                  : { opacity: 0, y: -6, filter: "blur(4px)" }
              }
              transition={{ duration: 0.18 }}
              className="inline-flex items-center justify-center"
            >
              {displayLabel}
            </motion.span>
          </AnimatePresence>
        </Button>
      </motion.span>
    );
  },
);

DontPressButton.displayName = "DontPressButton";

export default DontPressButton;
