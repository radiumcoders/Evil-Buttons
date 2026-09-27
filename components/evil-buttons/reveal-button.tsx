"use client";

import * as React from "react";
import { AnimatePresence, motion } from "motion/react";
import { cn } from "@/lib/utils";

export type RevealButtonVariant = "dark" | "light";

// Graded surfaces matching MinimalButton: outer hairline, faint inner ring, top highlight, soft drop.
// Revealed swaps the neutral inner ring for an emerald one.
const surfaces: Record<
  RevealButtonVariant,
  {
    base: string;
    revealed: string;
    label: string;
    value: string;
    chip: string;
    chipRevealed: string;
  }
> = {
  dark: {
    base: "text-neutral-50 bg-linear-to-b from-[#353535] to-[#272727] shadow-[0_0_0_1px_rgb(0_0_0/0.9),inset_0_0_0_1px_rgb(255_255_255/0.06),inset_0_1px_0_rgb(255_255_255/0.14),0_1px_2px_rgb(0_0_0/0.25),0_4px_12px_-4px_rgb(0_0_0/0.4)]",
    revealed:
      "shadow-[0_0_0_1px_rgb(0_0_0/0.9),inset_0_0_0_1px_rgb(52_211_153/0.35),inset_0_1px_0_rgb(255_255_255/0.14),0_1px_2px_rgb(0_0_0/0.25),0_4px_12px_-4px_rgb(16_185_129/0.35)]",
    label: "text-neutral-400",
    value: "text-neutral-50",
    chip: "bg-black/25 text-neutral-400 shadow-[inset_0_1px_2px_rgb(0_0_0/0.45),0_0_0_1px_rgb(255_255_255/0.07)]",
    chipRevealed:
      "text-emerald-400 shadow-[inset_0_1px_2px_rgb(0_0_0/0.45),0_0_0_1px_rgb(52_211_153/0.3)]",
  },
  light: {
    base: "text-neutral-900 bg-linear-to-b from-white to-neutral-100 shadow-[0_0_0_1px_rgb(0_0_0/0.1),inset_0_1px_0_rgb(255_255_255/0.9),0_1px_2px_rgb(0_0_0/0.06),0_4px_12px_-4px_rgb(0_0_0/0.14)]",
    revealed:
      "shadow-[0_0_0_1px_rgb(16_185_129/0.45),inset_0_1px_0_rgb(255_255_255/0.9),0_1px_2px_rgb(0_0_0/0.06),0_4px_12px_-4px_rgb(16_185_129/0.3)]",
    label: "text-neutral-500",
    value: "text-neutral-900",
    chip: "bg-neutral-200/60 text-neutral-500 shadow-[inset_0_1px_2px_rgb(0_0_0/0.12),0_0_0_1px_rgb(0_0_0/0.06)]",
    chipRevealed:
      "text-emerald-600 shadow-[inset_0_1px_2px_rgb(0_0_0/0.12),0_0_0_1px_rgb(16_185_129/0.35)]",
  },
};

export interface RevealButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  secret?: React.ReactNode;
  label?: React.ReactNode;
  hiddenLabel?: React.ReactNode;
  revealMode?: "hold" | "toggle";
  /** Dark (default) or light graded surface. */
  variant?: RevealButtonVariant;
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
      variant = "dark",
      maskedValue = "•••• •••• ••••",
      onRevealChange,
      className,
      type = "button",
      ...props
    },
    ref,
  ) => {
    const [revealed, setRevealed] = React.useState(false);
    const surface = surfaces[variant];

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
          "group relative inline-flex min-w-40 cursor-pointer items-center justify-between gap-3 overflow-hidden rounded-xl px-3 py-2 text-xs outline-none select-none sm:min-w-64 sm:gap-4 sm:px-4 sm:py-2.5 sm:text-sm",
          surface.base,
          "transition-[scale,filter,box-shadow] duration-300 ease-[cubic-bezier(0.34,1.35,0.64,1)] hover:brightness-110",
          "active:scale-[0.98] active:brightness-95 active:duration-100 active:ease-out motion-reduce:active:scale-100",
          "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50",
          revealed && surface.revealed,
          className,
        )}
        {...pressHandlers}
        {...props}
      >
        <span className="flex min-w-0 flex-col items-start">
          <span
            className={cn(
              "text-xs font-medium uppercase tracking-wider",
              surface.label,
            )}
          >
            {revealed ? label : hiddenLabel}
          </span>
          <AnimatePresence initial={false} mode="wait">
            <motion.span
              key={revealed ? "secret" : "masked"}
              initial={{ y: 6, opacity: 0, filter: "blur(4px)" }}
              animate={{ y: 0, opacity: 1, filter: "blur(0px)" }}
              exit={{ y: -6, opacity: 0, filter: "blur(4px)" }}
              transition={{ duration: 0.16 }}
              className={cn(
                "block max-w-28 truncate font-mono text-xs font-semibold sm:max-w-44 sm:text-sm",
                surface.value,
              )}
            >
              {revealed ? secret : maskedValue}
            </motion.span>
          </AnimatePresence>
        </span>
        <span
          aria-hidden
          className={cn(
            // Recessed chip: a sunken well with an inner shadow and a faint rim.
            "inline-flex size-7 shrink-0 items-center justify-center rounded-full transition-colors sm:size-9",
            surface.chip,
            revealed && surface.chipRevealed,
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
