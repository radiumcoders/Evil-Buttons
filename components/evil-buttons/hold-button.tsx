"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type HoldState = "idle" | "holding" | "success";

export interface HoldButtonProps
  extends Omit<
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    "onClick" | "onAbort"
  > {
  /** Time in milliseconds the user must hold before the action fires. */
  duration?: number;
  /** Label shown while idle. */
  label?: React.ReactNode;
  /** Label shown while the button is being held. */
  holdingLabel?: React.ReactNode;
  /** Label shown once the action completes. */
  successLabel?: React.ReactNode;
  /** Fired when the hold reaches 100%. */
  onConfirm?: () => void;
  /** Fired when the hold is released early. Receives the progress (0-1) reached. */
  onAbort?: (progress: number) => void;
  /** Milliseconds to stay in the success state before resetting. Set to 0 to stay. */
  resetAfter?: number;
}

const CheckIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.25"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="size-3.5 shrink-0"
    aria-hidden
  >
    <path d="M20 6 9 17l-5-5" />
  </svg>
);

export const HoldButton = React.forwardRef<HTMLButtonElement, HoldButtonProps>(
  (
    {
      duration = 1500,
      label = "Hold to delete",
      holdingLabel = "Keep holding…",
      successLabel = "Deleted",
      onConfirm,
      onAbort,
      resetAfter = 1400,
      className,
      disabled,
      type = "button",
      ...props
    },
    ref,
  ) => {
    const [state, setState] = React.useState<HoldState>("idle");
    const [width, setWidth] = React.useState(0);

    const buttonRef = React.useRef<HTMLButtonElement | null>(null);
    const fillRef = React.useRef<HTMLSpanElement | null>(null);
    const rafRef = React.useRef<number | null>(null);
    const startRef = React.useRef(0);
    const progressRef = React.useRef(0);
    const resetTimeoutRef = React.useRef<number | null>(null);

    const setButtonRef = (node: HTMLButtonElement | null) => {
      buttonRef.current = node;
      if (typeof ref === "function") ref(node);
      else if (ref) ref.current = node;
    };

    // Keep the knockout label sized to the full button width so the reveal
    // wipes cleanly left-to-right without distorting the text.
    React.useEffect(() => {
      const node = buttonRef.current;
      if (!node || typeof ResizeObserver === "undefined") return;
      const observer = new ResizeObserver(([entry]) => {
        setWidth(entry.contentRect.width + 32);
      });
      observer.observe(node);
      return () => observer.disconnect();
    }, []);

    React.useEffect(() => {
      return () => {
        if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
        if (resetTimeoutRef.current !== null) {
          window.clearTimeout(resetTimeoutRef.current);
        }
      };
    }, []);

    const stopLoop = () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };

    const setFill = (value: number, animated: boolean) => {
      progressRef.current = value;
      const node = fillRef.current;
      if (!node) return;
      node.style.transition = animated ? "width 260ms ease-out" : "none";
      node.style.width = `${value * 100}%`;
    };

    const complete = () => {
      stopLoop();
      setFill(1, false);
      setState("success");
      onConfirm?.();
      if (resetAfter > 0) {
        resetTimeoutRef.current = window.setTimeout(() => {
          setFill(0, true);
          setState("idle");
        }, resetAfter);
      }
    };

    const tick = (now: number) => {
      const value = Math.min((now - startRef.current) / duration, 1);
      setFill(value, false);
      if (value >= 1) {
        complete();
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    const startHold = () => {
      if (disabled || state !== "idle") return;
      if (resetTimeoutRef.current !== null) {
        window.clearTimeout(resetTimeoutRef.current);
      }
      setState("holding");
      startRef.current = performance.now();
      setFill(0, false);
      stopLoop();
      rafRef.current = requestAnimationFrame(tick);
    };

    const cancelHold = () => {
      if (state !== "holding") return;
      stopLoop();
      const reached = progressRef.current;
      setState("idle");
      setFill(0, true);
      buttonRef.current?.animate?.(
        [
          { transform: "translateX(0)" },
          { transform: "translateX(-4px)" },
          { transform: "translateX(4px)" },
          { transform: "translateX(-2px)" },
          { transform: "translateX(2px)" },
          { transform: "translateX(0)" },
        ],
        { duration: 300, easing: "ease-in-out" },
      );
      onAbort?.(reached);
    };

    const isSuccess = state === "success";
    const isHolding = state === "holding";

    const content = (
      <>
        {isSuccess ? <CheckIcon /> : null}
        <span>
          {isSuccess ? successLabel : isHolding ? holdingLabel : label}
        </span>
      </>
    );

    return (
      <button
        ref={setButtonRef}
        type={type}
        disabled={disabled}
        aria-live="polite"
        data-state={state}
        onPointerDown={(e) => {
          if (e.button !== 0 && e.pointerType === "mouse") return;
          e.currentTarget.setPointerCapture?.(e.pointerId);
          startHold();
        }}
        onPointerUp={cancelHold}
        onPointerCancel={cancelHold}
        onLostPointerCapture={cancelHold}
        onKeyDown={(e) => {
          if ((e.key === " " || e.key === "Enter") && !e.repeat) {
            e.preventDefault();
            startHold();
          }
        }}
        onKeyUp={(e) => {
          if (e.key === " " || e.key === "Enter") {
            e.preventDefault();
            cancelHold();
          }
        }}
        onContextMenu={(e) => e.preventDefault()}
        className={cn(
          "relative inline-flex h-9 min-w-44 cursor-pointer items-center justify-center overflow-hidden rounded-md border border-border bg-background px-4 text-sm font-medium text-foreground outline-none select-none transition-colors hover:bg-muted/60",
          "touch-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        {...props}
      >
        {/* Base label, visible where the fill has not yet covered. */}
        <span className="relative z-10 inline-flex items-center gap-1.5">
          {content}
        </span>

        {/* Fill overlay that wipes across and reveals a knockout inverted label. */}
        <span
          ref={fillRef}
          aria-hidden
          className="absolute inset-y-0 left-0 z-20 w-0 overflow-hidden bg-primary"
        >
          <span
            className="absolute inset-y-0 left-0 inline-flex items-center justify-center gap-1.5 text-primary-foreground"
            style={{ width: width ? `${width}px` : "100%" }}
          >
            {content}
          </span>
        </span>
      </button>
    );
  },
);

HoldButton.displayName = "HoldButton";

export default HoldButton;
