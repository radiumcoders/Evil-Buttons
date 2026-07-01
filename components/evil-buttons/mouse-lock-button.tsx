"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import {
  AnimatePresence,
  motion,
  useReducedMotion,
  type Variants,
} from "motion/react";
import { cn } from "@/lib/utils";

type MouseLockState = "idle" | "locked";

export interface MouseLockButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onClick"> {
  /** Trigger label. Falls back to `label` when no children are provided. */
  children?: React.ReactNode;
  /** Idle warning label used when no children are provided. */
  label?: React.ReactNode;
  /** Milliseconds to disable pointer input across the page after a click. */
  lockDuration?: number;
  /** Message shown on the full-screen lock overlay. */
  lockedMessage?: React.ReactNode;
  /** Fired when the lock begins. */
  onLock?: () => void;
  /** Fired when the lock ends. */
  onUnlock?: () => void;
}

const POINTER_BLOCK_EVENTS = [
  "click",
  "mousedown",
  "mouseup",
  "mousemove",
  "pointerdown",
  "pointerup",
  "pointermove",
  "contextmenu",
  "dblclick",
  "wheel",
] as const;

const WarningIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="size-4 shrink-0"
    aria-hidden
  >
    <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
    <path d="M12 9v4" />
    <path d="M12 17h.01" />
  </svg>
);

const labelVariants: Variants = {
  enter: { y: 6, opacity: 0 },
  center: { y: 0, opacity: 1 },
  exit: { y: -6, opacity: 0 },
};

function blockPointerEvent(event: Event) {
  event.preventDefault();
  event.stopPropagation();
}

export const MouseLockButton = React.forwardRef<
  HTMLButtonElement,
  MouseLockButtonProps
>(
  (
    {
      children,
      label = "Do NOT click this",
      lockDuration = 5000,
      lockedMessage = "You were warned.",
      onLock,
      onUnlock,
      className,
      disabled,
      type = "button",
      ...props
    },
    ref,
  ) => {
    const reduceMotion = useReducedMotion();
    const [state, setState] = React.useState<MouseLockState>("idle");
    const [remainingMs, setRemainingMs] = React.useState(0);
    const mounted = React.useSyncExternalStore(
      () => () => {},
      () => true,
      () => false,
    );

    const lockTimeoutRef = React.useRef<number | null>(null);
    const countdownIntervalRef = React.useRef<number | null>(null);
    const lockEndsAtRef = React.useRef(0);

    const clearTimers = React.useCallback(() => {
      if (lockTimeoutRef.current !== null) {
        window.clearTimeout(lockTimeoutRef.current);
        lockTimeoutRef.current = null;
      }
      if (countdownIntervalRef.current !== null) {
        window.clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
    }, []);

    const unlock = React.useCallback(() => {
      clearTimers();
      setState("idle");
      setRemainingMs(0);
      onUnlock?.();
    }, [clearTimers, onUnlock]);

    React.useEffect(() => () => clearTimers(), [clearTimers]);

    React.useEffect(() => {
      if (state !== "locked") return;

      const previousBodyCursor = document.body.style.cursor;
      const previousHtmlCursor = document.documentElement.style.cursor;

      document.body.style.cursor = "none";
      document.documentElement.style.cursor = "none";

      const options: AddEventListenerOptions = { capture: true };
      for (const eventName of POINTER_BLOCK_EVENTS) {
        document.addEventListener(eventName, blockPointerEvent, options);
      }

      return () => {
        document.body.style.cursor = previousBodyCursor;
        document.documentElement.style.cursor = previousHtmlCursor;

        for (const eventName of POINTER_BLOCK_EVENTS) {
          document.removeEventListener(eventName, blockPointerEvent, options);
        }
      };
    }, [state]);

    const handleClick = () => {
      if (disabled || state === "locked") return;

      clearTimers();
      lockEndsAtRef.current = Date.now() + lockDuration;
      setRemainingMs(lockDuration);
      setState("locked");
      onLock?.();

      countdownIntervalRef.current = window.setInterval(() => {
        const nextRemaining = Math.max(0, lockEndsAtRef.current - Date.now());
        setRemainingMs(nextRemaining);
        if (nextRemaining <= 0 && countdownIntervalRef.current !== null) {
          window.clearInterval(countdownIntervalRef.current);
          countdownIntervalRef.current = null;
        }
      }, 50);

      lockTimeoutRef.current = window.setTimeout(unlock, lockDuration);
    };

    const isLocked = state === "locked";
    const remainingSeconds = Math.max(1, Math.ceil(remainingMs / 1000));
    const displayLabel = children ?? label;

    const overlay =
      mounted && isLocked ? (
        <div
          className="fixed inset-0 z-[9999] flex cursor-none items-center justify-center bg-black/55 backdrop-blur-[1px]"
          role="alertdialog"
          aria-modal="true"
          aria-live="assertive"
          aria-label="Pointer input disabled"
        >
          <motion.div
            initial={reduceMotion ? false : { opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={reduceMotion ? undefined : { opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="pointer-events-none mx-4 max-w-sm rounded-xl border border-red-500/35 bg-neutral-950/90 px-6 py-5 text-center shadow-2xl"
          >
            <p className="text-sm font-semibold text-red-300">{lockedMessage}</p>
            <p className="mt-2 text-xs text-neutral-400">
              Mouse disabled for{" "}
              <span className="font-mono text-neutral-200">{remainingSeconds}</span>
              s
            </p>
          </motion.div>
        </div>
      ) : null;

    return (
      <>
        <button
          ref={ref}
          type={type}
          disabled={disabled || isLocked}
          aria-live="polite"
          data-state={state}
          onClick={handleClick}
          className={cn(
            "relative inline-flex min-w-48 select-none items-center justify-center gap-2 overflow-hidden rounded-md border px-4 py-2.5 text-sm font-semibold shadow-sm outline-none transition-colors",
            "border-red-500/45 bg-red-500/12 text-red-600 focus-visible:ring-2 focus-visible:ring-red-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
            "disabled:cursor-not-allowed disabled:opacity-50 dark:text-red-400",
            isLocked && "opacity-70",
            className,
          )}
          {...props}
        >
          <motion.span
            animate={
              reduceMotion || isLocked
                ? undefined
                : { scale: [1, 1.03, 1], opacity: [1, 0.92, 1] }
            }
            transition={{
              duration: 2.4,
              repeat: Infinity,
              ease: "easeInOut",
            }}
            className="inline-flex items-center gap-2"
          >
            <WarningIcon />
            <span className="relative inline-grid">
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.span
                  key={isLocked ? "locked" : "idle"}
                  variants={reduceMotion ? undefined : labelVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: 0.16, ease: "easeOut" }}
                  className="col-start-1 row-start-1 whitespace-nowrap text-center"
                >
                  {isLocked ? "Too late." : displayLabel}
                </motion.span>
              </AnimatePresence>
            </span>
          </motion.span>
        </button>

        {mounted && createPortal(
          <AnimatePresence>{overlay}</AnimatePresence>,
          document.body,
        )}
      </>
    );
  },
);

MouseLockButton.displayName = "MouseLockButton";

export default MouseLockButton;