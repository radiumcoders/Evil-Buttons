"use client";

import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
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
  /** Float a chip with the copied text up off the button. */
  showValue?: boolean;
  /** Fired with the copied text after a successful write. */
  onCopy?: (value: string) => void;
}

type CopyState = "idle" | "copied" | "error";

const ICON_SPRING = { type: "spring", stiffness: 420, damping: 24 } as const;

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

function Icon({ children }: { children: React.ReactNode }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-4"
    >
      {children}
    </svg>
  );
}

export const CopyButton = React.forwardRef<HTMLButtonElement, CopyButtonProps>(
  (
    {
      value,
      timeout = 1500,
      copyLabel = "Copy",
      copiedLabel = "Copied",
      errorLabel = "Copy failed",
      showValue = true,
      onCopy,
      className,
      onClick,
      type = "button",
      ...props
    },
    ref,
  ) => {
    const reduceMotion = useReducedMotion();
    const [state, setState] = React.useState<CopyState>("idle");
    // Each successful copy launches its own chip, so rapid copies stack.
    const [chips, setChips] = React.useState<{ id: number; text: string }[]>(
      [],
    );
    const chipIdRef = React.useRef(0);
    const timeoutRef = React.useRef<number | undefined>(undefined);

    React.useEffect(() => () => window.clearTimeout(timeoutRef.current), []);

    const handleClick = async (event: React.MouseEvent<HTMLButtonElement>) => {
      onClick?.(event);
      if (event.defaultPrevented) return;

      try {
        await writeClipboard(value);
        setState("copied");
        if (showValue && !reduceMotion) {
          const id = ++chipIdRef.current;
          setChips((current) => [...current, { id, text: value }]);
        }
        onCopy?.(value);
      } catch {
        setState("error");
      }

      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = window.setTimeout(() => setState("idle"), timeout);
    };

    const labels = { idle: copyLabel, copied: copiedLabel, error: errorLabel };

    return (
      <motion.button
        ref={ref}
        type={type}
        onClick={handleClick}
        data-state={state}
        whileTap={{ scale: 0.97 }}
        transition={{ type: "spring", stiffness: 500, damping: 30 }}
        className={cn(
          "relative inline-flex h-9 cursor-pointer items-center gap-2 rounded-md border border-border bg-background pr-4 pl-3 text-sm font-medium text-foreground shadow-xs outline-none select-none transition-colors hover:bg-accent/50",
          "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50",
          state === "error" && "border-destructive/50 text-destructive",
          className,
        )}
        {...props}
      >
        {/* The copied text lifts off the button, showing exactly what went to the clipboard. */}
        {chips.map((chip) => (
          <motion.span
            key={chip.id}
            aria-hidden
            className="pointer-events-none absolute bottom-full left-1/2 mb-1 max-w-56 truncate rounded-md bg-foreground px-2 py-1 font-mono text-[11px] leading-none text-background shadow-md"
            initial={{ x: "-50%", y: 10, opacity: 0, scale: 0.9 }}
            animate={{
              x: "-50%",
              y: [10, -4, -16],
              opacity: [0, 1, 0],
              scale: [0.9, 1, 1],
            }}
            transition={{ duration: 1.1, times: [0, 0.25, 1], ease: "easeOut" }}
            onAnimationComplete={() =>
              setChips((current) => current.filter(({ id }) => id !== chip.id))
            }
          >
            {chip.text}
          </motion.span>
        ))}

        <span className="relative inline-grid size-4 place-items-center">
          <AnimatePresence initial={false} mode="popLayout">
            <motion.span
              key={state}
              className="col-start-1 row-start-1"
              initial={{ scale: 0.4, opacity: 0, rotate: -30 }}
              animate={{ scale: 1, opacity: 1, rotate: 0 }}
              exit={{ scale: 0.4, opacity: 0, rotate: 30 }}
              transition={ICON_SPRING}
            >
              {state === "copied" ? (
                <Icon>
                  <path d="M20 6 9 17l-5-5" />
                </Icon>
              ) : state === "error" ? (
                <Icon>
                  <path d="M18 6 6 18" />
                  <path d="m6 6 12 12" />
                </Icon>
              ) : (
                <Icon>
                  <rect x="8" y="8" width="12" height="12" rx="2" />
                  <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
                </Icon>
              )}
            </motion.span>
          </AnimatePresence>
        </span>

        <span className="relative inline-grid text-left">
          {/* Invisible copies of every label keep the width steady between states. */}
          {Object.entries(labels).map(([key, label]) => (
            <span
              key={key}
              aria-hidden
              className="invisible col-start-1 row-start-1 whitespace-nowrap"
            >
              {label}
            </span>
          ))}
          <AnimatePresence initial={false} mode="popLayout">
            <motion.span
              key={state}
              className="col-start-1 row-start-1 whitespace-nowrap"
              initial={{ y: 8, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -8, opacity: 0 }}
              transition={{ duration: 0.16, ease: "easeOut" }}
            >
              {labels[state]}
            </motion.span>
          </AnimatePresence>
        </span>

        <span role="status" className="sr-only">
          {state === "copied"
            ? "Copied to clipboard"
            : state === "error"
              ? "Copy failed"
              : ""}
        </span>
      </motion.button>
    );
  },
);

CopyButton.displayName = "CopyButton";
