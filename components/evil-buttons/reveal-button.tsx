"use client";

import * as React from "react";
import { AnimatePresence, motion } from "motion/react";
import { cn } from "@/lib/utils";

export interface RevealButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  secret?: React.ReactNode;
  label?: React.ReactNode;
  hiddenLabel?: React.ReactNode;
  revealMode?: "hold" | "toggle";
  maskedValue?: string;
  onRevealChange?: (revealed: boolean) => void;
}

export const RevealButton = React.forwardRef<
  HTMLButtonElement,
  RevealButtonProps
>(
  (
    {
      secret = "sk_live_••••_9xQ4",
      label = "Reveal",
      hiddenLabel = "Hidden",
      revealMode = "hold",
      maskedValue = "•••• •••• ••••",
      onRevealChange,
      className,
      type = "button",
      ...props
    },
    ref,
  ) => {
    const [revealed, setRevealed] = React.useState(false);

    const updateRevealed = (next: boolean) => {
      setRevealed(next);
      onRevealChange?.(next);
    };

    const pressHandlers =
      revealMode === "hold"
        ? {
            onPointerDown: () => updateRevealed(true),
            onPointerUp: () => updateRevealed(false),
            onPointerLeave: () => updateRevealed(false),
            onBlur: () => updateRevealed(false),
            onKeyDown: (e: React.KeyboardEvent<HTMLButtonElement>) => {
              if ((e.key === " " || e.key === "Enter") && !e.repeat) {
                e.preventDefault();
                updateRevealed(true);
              }
            },
            onKeyUp: (e: React.KeyboardEvent<HTMLButtonElement>) => {
              if (e.key === " " || e.key === "Enter") {
                e.preventDefault();
                updateRevealed(false);
              }
            },
          }
        : {
            onClick: () => updateRevealed(!revealed),
          };

    return (
      <button
        ref={ref}
        type={type}
        aria-pressed={revealed}
        aria-live="polite"
        data-state={revealed ? "revealed" : "hidden"}
        className={cn(
          "group relative inline-flex min-w-40 items-center justify-between gap-3 overflow-hidden rounded-md border border-border bg-background px-3 py-2 text-xs shadow-sm transition-colors sm:min-w-64 sm:gap-4 sm:px-4 sm:py-2.5 sm:text-sm",
          "hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60",
          revealed && "border-emerald-500/50 bg-emerald-500/10",
          className,
        )}
        {...pressHandlers}
        {...props}
      >
        <span className="flex min-w-0 flex-col items-start">
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {revealed ? label : hiddenLabel}
          </span>
          <AnimatePresence initial={false} mode="wait">
            <motion.span
              key={revealed ? "secret" : "masked"}
              initial={{ y: 6, opacity: 0, filter: "blur(4px)" }}
              animate={{ y: 0, opacity: 1, filter: "blur(0px)" }}
              exit={{ y: -6, opacity: 0, filter: "blur(4px)" }}
              transition={{ duration: 0.16 }}
              className="block max-w-28 truncate font-mono text-xs font-semibold text-foreground sm:max-w-44 sm:text-sm"
            >
              {revealed ? secret : maskedValue}
            </motion.span>
          </AnimatePresence>
        </span>
        <span
          aria-hidden
          className={cn(
            "inline-flex size-7 shrink-0 items-center justify-center rounded-full border border-border bg-background text-muted-foreground transition-colors sm:size-9",
            revealed &&
              "border-emerald-500/40 text-emerald-600 dark:text-emerald-400",
          )}
        >
          {revealed ? (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.25"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="size-4"
            >
              <path d="m3 3 18 18" />
              <path d="M10.58 10.58a2 2 0 0 0 2.83 2.83" />
              <path d="M9.88 4.24A10.94 10.94 0 0 1 12 4c7 0 10 8 10 8a18.5 18.5 0 0 1-2.16 3.19" />
              <path d="M6.61 6.61A18.7 18.7 0 0 0 2 12s3 8 10 8a10.8 10.8 0 0 0 5.39-1.61" />
            </svg>
          ) : (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.25"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="size-4"
            >
              <path d="M2 12s3-8 10-8 10 8 10 8-3 8-10 8-10-8-10-8Z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          )}
        </span>
      </button>
    );
  },
);

RevealButton.displayName = "RevealButton";
