"use client";

import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type MorphStatus = "idle" | "loading" | "success" | "error";

export interface MorphStatusButtonProps
  extends Omit<React.ComponentProps<typeof Button>, "onClick"> {
  /** Idle label. Falls back to `label`. */
  children?: React.ReactNode;
  /** Idle label used when no children are provided. */
  label?: React.ReactNode;
  /** Label shown while the action is in flight. */
  loadingLabel?: React.ReactNode;
  /** Label shown after the action resolves. */
  successLabel?: React.ReactNode;
  /** Label shown after the action rejects. */
  errorLabel?: React.ReactNode;
  /**
   * Click handler. If it returns a promise, the button auto-transitions
   * through loading and into success or error based on the outcome.
   */
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void | Promise<unknown>;
  /**
   * Controlled status. When provided, the button reflects this value and the
   * promise-based auto-transitions are ignored.
   */
  status?: MorphStatus;
  /** Milliseconds to stay in success/error before resetting. Set to 0 to stay. */
  resetAfter?: number;
}

const Spinner = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    className="size-4 shrink-0 animate-spin"
    aria-hidden
  >
    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
  </svg>
);

const CheckIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="size-4 shrink-0"
    aria-hidden
  >
    <path d="M20 6 9 17l-5-5" />
  </svg>
);

const XIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="size-4 shrink-0"
    aria-hidden
  >
    <path d="M18 6 6 18" />
    <path d="m6 6 12 12" />
  </svg>
);

function textOf(node: React.ReactNode): string {
  if (node === null || node === undefined || typeof node === "boolean") {
    return "";
  }
  if (typeof node === "string" || typeof node === "number") {
    return String(node);
  }
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (React.isValidElement<{ children?: React.ReactNode }>(node)) {
    return textOf(node.props.children);
  }
  return "";
}

export const MorphStatusButton = React.forwardRef<
  HTMLButtonElement,
  MorphStatusButtonProps
>(
  (
    {
      children,
      label = "Save changes",
      loadingLabel = "Working…",
      successLabel = "Done",
      errorLabel = "It broke. Your fault.",
      onClick,
      status: controlledStatus,
      resetAfter = 1800,
      variant = "outline",
      size = "lg",
      className,
      disabled,
      ...props
    },
    ref,
  ) => {
    const reduceMotion = useReducedMotion();
    const [internal, setInternal] = React.useState<MorphStatus>("idle");
    const resetTimeoutRef = React.useRef<number | null>(null);

    const isControlled = controlledStatus !== undefined;
    const status = isControlled ? controlledStatus : internal;

    const clearReset = () => {
      if (resetTimeoutRef.current !== null) {
        window.clearTimeout(resetTimeoutRef.current);
        resetTimeoutRef.current = null;
      }
    };

    React.useEffect(() => () => clearReset(), []);

    const scheduleReset = () => {
      if (isControlled || resetAfter <= 0) return;
      clearReset();
      resetTimeoutRef.current = window.setTimeout(() => {
        setInternal("idle");
      }, resetAfter);
    };

    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      if (status === "loading") return;
      const result = onClick?.(e);

      if (isControlled || !(result instanceof Promise)) return;

      clearReset();
      setInternal("loading");
      result
        .then(() => {
          setInternal("success");
          scheduleReset();
        })
        .catch(() => {
          setInternal("error");
          scheduleReset();
        });
    };

    const idleLabel = children ?? label;
    const currentLabel: React.ReactNode =
      status === "loading"
        ? loadingLabel
        : status === "success"
          ? successLabel
          : status === "error"
            ? errorLabel
            : idleLabel;

    const icon =
      status === "loading" ? (
        <Spinner />
      ) : status === "success" ? (
        <CheckIcon />
      ) : status === "error" ? (
        <XIcon />
      ) : null;

    // Widest possible label reserves width so the button never reflows.
    const widest = [
      idleLabel,
      loadingLabel,
      successLabel,
      errorLabel,
    ].reduce<React.ReactNode>(
      (widestNode, candidate) =>
        textOf(candidate).length > textOf(widestNode).length
          ? candidate
          : widestNode,
      "",
    );

    return (
      <Button
        ref={ref}
        type="button"
        variant={status === "error" ? "destructive" : variant}
        size={size}
        onClick={handleClick}
        disabled={disabled || status === "loading"}
        aria-live="polite"
        aria-busy={status === "loading"}
        data-state={status}
        className={cn(
          "relative overflow-hidden rounded-md px-4 font-semibold transition-colors",
          className,
        )}
        {...props}
      >
        {/* Invisible widest label reserves a stable width. */}
        <span aria-hidden className="invisible inline-flex items-center gap-2">
          <span className="size-4" />
          {widest}
        </span>

        <span className="absolute inset-0 flex items-center justify-center gap-2">
          {icon ? (
            <span className="relative inline-flex size-4 items-center justify-center">
              <AnimatePresence initial={false} mode="wait">
                <motion.span
                  key={status}
                  initial={reduceMotion ? false : { scale: 0.4, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={reduceMotion ? undefined : { scale: 0.4, opacity: 0 }}
                  transition={{ type: "spring", stiffness: 380, damping: 22 }}
                  className="inline-flex"
                >
                  {icon}
                </motion.span>
              </AnimatePresence>
            </span>
          ) : null}
          <span className="relative inline-block">
            <AnimatePresence initial={false} mode="wait">
              <motion.span
                key={status}
                initial={reduceMotion ? false : { y: 8, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={reduceMotion ? undefined : { y: -8, opacity: 0 }}
                transition={{ duration: 0.16 }}
                className="inline-block whitespace-nowrap"
              >
                {currentLabel}
              </motion.span>
            </AnimatePresence>
          </span>
        </span>
      </Button>
    );
  },
);

MorphStatusButton.displayName = "MorphStatusButton";

export default MorphStatusButton;
