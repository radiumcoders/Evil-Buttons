"use client";

import * as React from "react";
import { AnimatePresence, motion } from "motion/react";
import { cn } from "@/lib/utils";

export interface CopyButtonProps extends Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  | "value"
  | "onCopy"
  | "onDrag"
  | "onDragStart"
  | "onDragEnd"
  | "onAnimationStart"
> {
  /** Text written to the clipboard. */
  value: string;
  /** Milliseconds before the button returns to its idle state. */
  timeout?: number;
  /** Label shown before copying. */
  copyLabel?: React.ReactNode;
  /** Label shown after a successful copy. */
  copiedLabel?: React.ReactNode;
  /** Label shown when the clipboard write fails. */
  errorLabel?: React.ReactNode;
  /** Show the copied text in a small chip above the button after copying. */
  showValue?: boolean;
  /** Fired with the copied text after a successful write. */
  onCopy?: (value: string) => void;
}

type CopyState = "idle" | "copied" | "error";

const SWAP = { type: "spring", stiffness: 420, damping: 30 } as const;

/** Clipboard API first, then the legacy selection fallback for insecure pages. */
async function writeClipboard(text: string) {
  if (navigator.clipboard?.writeText && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  const ok = document.execCommand("copy");
  textarea.remove();
  if (!ok) throw new Error("Copy command was rejected");
}

const ICONS: Record<CopyState, React.ReactNode> = {
  idle: (
    <>
      <rect x="8" y="8" width="12" height="12" rx="2" />
      <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
    </>
  ),
  copied: <path d="M20 6 9 17l-5-5" />,
  error: (
    <>
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </>
  ),
};

const STATES: CopyState[] = ["idle", "copied", "error"];

export const CopyButton = React.forwardRef<HTMLButtonElement, CopyButtonProps>(
  (
    {
      value,
      timeout = 1500,
      copyLabel = "Copy",
      copiedLabel = "Copied",
      errorLabel = "Failed",
      showValue = true,
      onCopy,
      className,
      onClick,
      type = "button",
      ...props
    },
    ref,
  ) => {
    const [state, setState] = React.useState<CopyState>("idle");
    const timeoutRef = React.useRef<number | undefined>(undefined);

    React.useEffect(() => () => window.clearTimeout(timeoutRef.current), []);

    const handleClick = async (event: React.MouseEvent<HTMLButtonElement>) => {
      onClick?.(event);
      if (event.defaultPrevented) return;

      try {
        await writeClipboard(value);
        setState("copied");
        onCopy?.(value);
      } catch {
        setState("error");
      }

      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = window.setTimeout(() => setState("idle"), timeout);
    };

    const labels: Record<CopyState, React.ReactNode> = {
      idle: copyLabel,
      copied: copiedLabel,
      error: errorLabel,
    };

    return (
      <button
        ref={ref}
        type={type}
        onClick={handleClick}
        data-state={state}
        className={cn(
          "relative inline-flex h-9 cursor-pointer items-center justify-center gap-2 rounded-md border border-border bg-background px-4 text-sm font-medium text-foreground shadow-[0_1px_2px_rgb(0_0_0/0.05),0_2px_6px_-3px_rgb(0_0_0/0.07),inset_0_-1px_0_rgb(0_0_0/0.03)] dark:shadow-[0_1px_2px_rgb(0_0_0/0.4),inset_0_1px_0_rgb(255_255_255/0.05)] outline-none select-none transition-colors hover:bg-muted/60",
          "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50",
          "data-[state=error]:text-destructive",
          className,
        )}
        {...props}
      >
        <AnimatePresence>
          {showValue && state === "copied" ? (
            <motion.span
              aria-hidden
              className="pointer-events-none absolute bottom-full left-1/2 mb-2 max-w-56 -translate-x-1/2 truncate rounded-md bg-foreground px-2 py-1 font-mono text-[11px] leading-4 text-background"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -2 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
            >
              {value}
            </motion.span>
          ) : null}
        </AnimatePresence>

        {/* All icons stay mounted and crossfade in place, so nothing reflows. */}
        <span aria-hidden className="grid size-4 shrink-0">
          {STATES.map((key) => (
            <motion.svg
              key={key}
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="col-start-1 row-start-1 size-4"
              initial={false}
              animate={
                state === key
                  ? { opacity: 1, scale: 1 }
                  : { opacity: 0, scale: 0.5 }
              }
              transition={SWAP}
            >
              {ICONS[key]}
            </motion.svg>
          ))}
        </span>

        {/* Every label is stacked in one cell; the widest sets the width. */}
        <span className="grid">
          {STATES.map((key) => (
            <motion.span
              key={key}
              aria-hidden={state !== key}
              className="col-start-1 row-start-1 whitespace-nowrap"
              initial={false}
              animate={
                state === key ? { opacity: 1, y: 0 } : { opacity: 0, y: 6 }
              }
              transition={{ duration: 0.15, ease: "easeOut" }}
            >
              {labels[key]}
            </motion.span>
          ))}
        </span>

        <span role="status" className="sr-only">
          {state === "copied"
            ? "Copied to clipboard"
            : state === "error"
              ? "Copy failed"
              : ""}
        </span>
      </button>
    );
  },
);

CopyButton.displayName = "CopyButton";
