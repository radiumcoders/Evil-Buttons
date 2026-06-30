"use client";

import * as React from "react";
import {
  animate,
  mapValue,
  motionValue,
  press,
  styleEffect,
  svgEffect,
} from "motion";
import { cn } from "@/lib/utils";

type HoldConfirmState = "idle" | "holding" | "success";

export interface HoldConfirmButtonProps
  extends Omit<
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    "onClick" | "onAbort"
  > {
  /** Milliseconds the user must hold before `onConfirm` fires. */
  duration?: number;
  /** Label shown while idle. */
  label?: React.ReactNode;
  /** Optional label shown while holding. Falls back to `label`. */
  holdingLabel?: React.ReactNode;
  /** Label shown after a successful hold. */
  successLabel?: React.ReactNode;
  /** Smallest scale reached at 100% progress. */
  minScale?: number;
  /** Diameter of the progress ring in pixels. */
  ringSize?: number;
  /** Stroke width of the progress ring. */
  ringStrokeWidth?: number;
  /** Color of the progress ring. */
  ringColor?: string;
  /** Fired when the hold reaches 100%. */
  onConfirm?: () => void;
  /** Fired when the hold is released early. Receives progress reached (0-1). */
  onAbort?: (progress: number) => void;
  /** Milliseconds to stay in the success state before resetting. Set to 0 to stay. */
  resetAfter?: number;
}

export const HoldConfirmButton = React.forwardRef<
  HTMLButtonElement,
  HoldConfirmButtonProps
>(
  (
    {
      duration = 2000,
      label = "Hold to confirm",
      holdingLabel,
      successLabel = "Confirmed",
      minScale = 0.9,
      ringSize = 200,
      ringStrokeWidth = 3,
      ringColor = "#5eead4",
      onConfirm,
      onAbort,
      resetAfter = 1600,
      className,
      disabled,
      type = "button",
      ...props
    },
    ref,
  ) => {
    const [state, setState] = React.useState<HoldConfirmState>("idle");

    const buttonRef = React.useRef<HTMLButtonElement | null>(null);
    const circleRef = React.useRef<SVGCircleElement | null>(null);
    const animationRef = React.useRef<ReturnType<typeof animate> | null>(null);
    const stateRef = React.useRef<HoldConfirmState>("idle");
    const resetTimeoutRef = React.useRef<number | null>(null);

    const setButtonRef = (node: HTMLButtonElement | null) => {
      buttonRef.current = node;
      if (typeof ref === "function") ref(node);
      else if (ref) ref.current = node;
    };

    React.useEffect(() => {
      stateRef.current = state;
    }, [state]);

    React.useEffect(() => {
      const button = buttonRef.current;
      const circle = circleRef.current;
      if (!button || !circle || disabled) return;

      const progress = motionValue(0);
      const scale = mapValue(progress, [0, 1], [1, minScale]);

      const cancelStyle = styleEffect(button, { scale });
      const cancelSvg = svgEffect(circle, { pathLength: progress });

      const stopAnimation = () => {
        animationRef.current?.stop();
        animationRef.current = null;
      };

      const rewind = () => {
        stopAnimation();
        animate(progress, 0, { duration: 0.28, ease: "easeOut" });
      };

      const complete = () => {
        stopAnimation();
        progress.set(1);
        setState("success");
        onConfirm?.();

        if (resetAfter > 0) {
          if (resetTimeoutRef.current !== null) {
            window.clearTimeout(resetTimeoutRef.current);
          }
          resetTimeoutRef.current = window.setTimeout(() => {
            rewind();
            setState("idle");
          }, resetAfter);
        }
      };

      const cancelPress = press(button, () => {
        if (stateRef.current !== "idle") return;

        if (resetTimeoutRef.current !== null) {
          window.clearTimeout(resetTimeoutRef.current);
        }

        setState("holding");
        stopAnimation();
        progress.set(0);

        animationRef.current = animate(progress, 1, {
          duration: duration / 1000,
          ease: "linear",
          onComplete: complete,
        });

        return (_endEvent, { success }) => {
          if (stateRef.current === "success") return;

          if (!success || progress.get() < 1) {
            const reached = progress.get();
            setState("idle");
            rewind();
            onAbort?.(reached);
          }
        };
      });

      return () => {
        cancelPress();
        cancelStyle();
        cancelSvg();
        stopAnimation();
        if (resetTimeoutRef.current !== null) {
          window.clearTimeout(resetTimeoutRef.current);
        }
      };
    }, [disabled, duration, minScale, onAbort, onConfirm, resetAfter]);

    const radius = ringSize / 2 - ringStrokeWidth * 2 - 10;
    const center = ringSize / 2;
    const isHolding = state === "holding";
    const isSuccess = state === "success";
    const displayLabel = isSuccess
      ? successLabel
      : isHolding && holdingLabel !== undefined
        ? holdingLabel
        : label;

    return (
      <div
        className="relative inline-flex items-center justify-center"
        style={{ width: ringSize, height: ringSize }}
      >
        <svg
          className="pointer-events-none absolute inset-0 -rotate-90"
          width={ringSize}
          height={ringSize}
          viewBox={`0 0 ${ringSize} ${ringSize}`}
          aria-hidden
        >
          <circle
            ref={circleRef}
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke={ringColor}
            strokeWidth={ringStrokeWidth}
            strokeLinecap="round"
          />
        </svg>

        <button
          ref={setButtonRef}
          type={type}
          disabled={disabled}
          aria-live="polite"
          data-state={state}
          className={cn(
            "relative z-10 inline-flex select-none items-center justify-center rounded-full bg-neutral-100 px-6 py-2.5 text-sm font-medium text-neutral-900 shadow-sm outline-none",
            "touch-none focus-visible:ring-2 focus-visible:ring-emerald-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50",
            isSuccess && "bg-emerald-50 text-emerald-700",
            className,
          )}
          {...props}
        >
          {displayLabel}
        </button>
      </div>
    );
  },
);

HoldConfirmButton.displayName = "HoldConfirmButton";

export default HoldConfirmButton;