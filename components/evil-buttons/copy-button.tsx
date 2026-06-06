"use client";

import * as React from "react";
import { AnimatePresence, motion } from "motion/react";
import { cn } from "@/lib/utils";

export interface CopyButtonProps
  extends Omit<
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    "value" | "onCopy"
  > {
  value: string;
  timeout?: number;
  copyLabel?: React.ReactNode;
  copiedLabel?: React.ReactNode;
  onCopy?: (value: string) => void;
}

type CopyState = "idle" | "copied" | "error";

export const CopyButton = React.forwardRef<HTMLButtonElement, CopyButtonProps>(
  (
    {
      value,
      timeout = 1500,
      copyLabel = "Copy",
      copiedLabel = "Copied",
      onCopy,
      className,
      onClick,
      ...props
    },
    ref,
  ) => {
    const [state, setState] = React.useState<CopyState>("idle");
    const timeoutRef = React.useRef<number | null>(null);

    React.useEffect(() => {
      return () => {
        if (timeoutRef.current !== null) {
          window.clearTimeout(timeoutRef.current);
        }
      };
    }, []);

    const handleClick = async (e: React.MouseEvent<HTMLButtonElement>) => {
      onClick?.(e);
      if (e.defaultPrevented) return;

      try {
        if (
          typeof navigator !== "undefined" &&
          navigator.clipboard?.writeText
        ) {
          await navigator.clipboard.writeText(value);
        } else {
          throw new Error("Clipboard API unavailable");
        }
        setState("copied");
        onCopy?.(value);
      } catch {
        setState("error");
      }

      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = window.setTimeout(() => {
        setState("idle");
      }, timeout);
    };

    const isCopied = state === "copied";
    const isError = state === "error";

    return (
      <button
        ref={ref}
        type="button"
        onClick={handleClick}
        aria-live="polite"
        data-state={state}
        className={cn(
          "group inline-flex items-center gap-2 rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-foreground shadow-sm transition-colors",
          "hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          isCopied &&
            "border-emerald-500/50 text-emerald-600 dark:text-emerald-400",
          isError && "border-red-500/50 text-red-600 dark:text-red-400",
          className,
        )}
        {...props}
      >
        <span className="relative inline-flex size-4 items-center justify-center">
          <AnimatePresence initial={false} mode="wait">
            {isCopied ? (
              <motion.svg
                key="check"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.25"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="size-4"
                initial={{ scale: 0.4, opacity: 0, rotate: -25 }}
                animate={{ scale: 1, opacity: 1, rotate: 0 }}
                exit={{ scale: 0.4, opacity: 0, rotate: 25 }}
                transition={{ type: "spring", stiffness: 380, damping: 22 }}
              >
                <path d="M20 6 9 17l-5-5" />
              </motion.svg>
            ) : isError ? (
              <motion.svg
                key="x"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.25"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="size-4"
                initial={{ scale: 0.4, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.4, opacity: 0 }}
                transition={{ type: "spring", stiffness: 380, damping: 22 }}
              >
                <path d="M18 6 6 18" />
                <path d="m6 6 12 12" />
              </motion.svg>
            ) : (
              <motion.svg
                key="clipboard"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="size-4"
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.6, opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                <rect x="9" y="3" width="6" height="4" rx="1" />
                <path d="M9 5H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-3" />
              </motion.svg>
            )}
          </AnimatePresence>
        </span>
        <span className="relative inline-block min-w-[3ch] text-left">
          <AnimatePresence initial={false} mode="wait">
            <motion.span
              key={state}
              initial={{ y: 8, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -8, opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="inline-block"
            >
              {isCopied ? copiedLabel : isError ? "Failed" : copyLabel}
            </motion.span>
          </AnimatePresence>
        </span>
      </button>
    );
  },
);

CopyButton.displayName = "CopyButton";
