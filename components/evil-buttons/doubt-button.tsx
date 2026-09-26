"use client";

import * as React from "react";
import {
  AnimatePresence,
  motion,
  useReducedMotion,
  type Variants,
} from "motion/react";
import { cn } from "@/lib/utils";

type DoubtState = "idle" | "doubting" | "success";

export interface DoubtButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onClick"> {
  /** Label shown before any doubt has been cast. Falls back to `label`. */
  children?: React.ReactNode;
  /** Label shown in the idle state when no children are provided. */
  label?: React.ReactNode;
  /**
   * Escalating confirmation prompts shown one per click. The final prompt, when
   * clicked, fires `onConfirm`. The user must click `confirmations.length + 1`
   * times total before the real action runs.
   */
  confirmations?: React.ReactNode[];
  /** Label flashed once the user finally pushes through every doubt. */
  successLabel?: React.ReactNode;
  /** Fired only after the last confirmation is clicked. */
  onConfirm?: () => void;
  /** Milliseconds to stay in the success state before resetting. Set to 0 to stay. */
  resetAfter?: number;
}

const DEFAULT_CONFIRMATIONS: string[] = [
  "Are you sure?",
  "Really, truly sure?",
  "There is no undo. Still?",
  "Think of the consequences.",
  "I am obligated to ask again.",
  "Last chance. Absolutely certain?",
];

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

const labelVariants: Variants = {
  enter: { y: 8, opacity: 0 },
  center: { y: 0, opacity: 1 },
  exit: { y: -8, opacity: 0 },
};

export const DoubtButton = React.forwardRef<
  HTMLButtonElement,
  DoubtButtonProps
>(
  (
    {
      children,
      label = "Delete everything",
      confirmations = DEFAULT_CONFIRMATIONS,
      successLabel = "Too late.",
      onConfirm,
      resetAfter = 1600,
      className,
      disabled,
      type = "button",
      ...props
    },
    ref,
  ) => {
    const reduceMotion = useReducedMotion();

    // 0 = idle; 1..steps show confirmations[index - 1]; clicking the last fires.
    const [index, setIndex] = React.useState(0);
    const [state, setState] = React.useState<DoubtState>("idle");
    const [shakeKey, setShakeKey] = React.useState(0);

    const resetTimeoutRef = React.useRef<number | null>(null);

    const steps = confirmations.length;

    const clearResetTimeout = () => {
      if (resetTimeoutRef.current !== null) {
        window.clearTimeout(resetTimeoutRef.current);
        resetTimeoutRef.current = null;
      }
    };

    React.useEffect(() => () => clearResetTimeout(), []);

    const handleClick = () => {
      if (disabled || state === "success") return;

      // No confirmations configured: behave like a normal one-shot button.
      if (steps === 0) {
        fire();
        return;
      }

      if (index < steps) {
        setIndex((i) => i + 1);
        setState("doubting");
        setShakeKey((k) => k + 1);
        return;
      }

      fire();
    };

    const fire = () => {
      clearResetTimeout();
      setState("success");
      setIndex(0);
      onConfirm?.();
      if (resetAfter > 0) {
        resetTimeoutRef.current = window.setTimeout(() => {
          setState("idle");
        }, resetAfter);
      }
    };

    const isSuccess = state === "success";

    // Share of doubts answered, drawn as a hairline along the bottom edge.
    const progress = isSuccess ? 1 : steps === 0 ? 0 : index / steps;

    const currentLabel: React.ReactNode = isSuccess
      ? successLabel
      : index === 0
        ? (children ?? label)
        : confirmations[index - 1];

    // A stable key so AnimatePresence animates between distinct prompts.
    const labelKey = isSuccess ? "success" : `step-${index}`;

    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled}
        aria-live="polite"
        data-state={state}
        onClick={handleClick}
        className={cn(
          "relative inline-flex h-9 min-w-48 cursor-pointer items-center justify-center overflow-hidden rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground outline-none select-none transition-[background-color,opacity] hover:bg-primary/90",
          "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        {...props}
      >
        <motion.span
          key={shakeKey}
          animate={
            reduceMotion || shakeKey === 0 || isSuccess
              ? undefined
              : { x: [0, -4, 4, -2, 2, 0] }
          }
          transition={{ duration: 0.3, ease: "easeInOut" }}
          className="inline-flex items-center gap-1.5"
        >
          {isSuccess ? <CheckIcon /> : null}
          <span className="relative inline-grid">
            {/* Invisible widest prompt reserves width so the button never jumps. */}
            <span
              aria-hidden
              className="invisible col-start-1 row-start-1 whitespace-nowrap"
            >
              {[label, successLabel, ...confirmations].reduce<React.ReactNode>(
                (widest, candidate) =>
                  String(extractText(candidate)).length >
                  String(extractText(widest)).length
                    ? candidate
                    : widest,
                "",
              )}
            </span>
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.span
                key={labelKey}
                variants={reduceMotion ? undefined : labelVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.18, ease: "easeOut" }}
                className="col-start-1 row-start-1 whitespace-nowrap text-center"
              >
                {currentLabel}
              </motion.span>
            </AnimatePresence>
          </span>
        </motion.span>

        {steps > 0 && (
          <span
            aria-hidden
            className="absolute inset-x-0 bottom-0 h-0.5 origin-left bg-current opacity-50 transition-transform duration-300 ease-out"
            style={{ transform: `scaleX(${progress})` }}
          />
        )}
      </button>
    );
  },
);

function extractText(node: React.ReactNode): string {
  if (node === null || node === undefined || typeof node === "boolean") {
    return "";
  }
  if (typeof node === "string" || typeof node === "number") {
    return String(node);
  }
  if (Array.isArray(node)) {
    return node.map(extractText).join("");
  }
  if (React.isValidElement<{ children?: React.ReactNode }>(node)) {
    return extractText(node.props.children);
  }
  return "";
}

DoubtButton.displayName = "DoubtButton";

export default DoubtButton;
