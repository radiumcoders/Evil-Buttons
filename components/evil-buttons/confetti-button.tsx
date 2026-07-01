"use client";

import * as React from "react";
import confetti from "canvas-confetti";
import { motion, useAnimationControls } from "motion/react";
import { Button } from "@/components/ui/button";

export interface ConfettiButtonProps
  extends Omit<React.ComponentProps<typeof Button>, "onClick"> {
  /** Button label. Falls back to `label` when no children are provided. */
  children?: React.ReactNode;
  /** Label used when no children are provided. */
  label?: React.ReactNode;
  /** Confetti particles per burst. */
  particleCount?: number;
  /** Confetti spread in degrees. */
  spread?: number;
  /** Extra vertical launch velocity. */
  startVelocity?: number;
  /** Custom confetti colors. */
  colors?: string[];
  /** Fired after each confetti burst. */
  onCelebrate?: () => void;
}

function burstFromElement(
  element: HTMLElement,
  options: {
    particleCount: number;
    spread: number;
    startVelocity: number;
    colors?: string[];
  },
) {
  const rect = element.getBoundingClientRect();
  const x = (rect.left + rect.width / 2) / window.innerWidth;
  const y = (rect.top + rect.height / 2) / window.innerHeight;

  void confetti({
    particleCount: options.particleCount,
    spread: options.spread,
    startVelocity: options.startVelocity,
    origin: { x, y },
    colors: options.colors,
    disableForReducedMotion: true,
  });
}

export const ConfettiButton = React.forwardRef<
  HTMLButtonElement,
  ConfettiButtonProps
>(
  (
    {
      children,
      label = "Continue",
      particleCount = 120,
      spread = 72,
      startVelocity = 38,
      colors,
      onCelebrate,
      className,
      disabled,
      variant,
      size,
      type = "button",
      ...props
    },
    ref,
  ) => {
    const buttonRef = React.useRef<HTMLButtonElement | null>(null);
    const popControls = useAnimationControls();

    const setButtonRef = (node: HTMLButtonElement | null) => {
      buttonRef.current = node;
      if (typeof ref === "function") ref(node);
      else if (ref) ref.current = node;
    };

    const handleClick = () => {
      if (disabled || !buttonRef.current) return;

      burstFromElement(buttonRef.current, {
        particleCount,
        spread,
        startVelocity,
        colors,
      });
      onCelebrate?.();

      void popControls
        .start({
          scale: 1.12,
          transition: {
            type: "spring",
            stiffness: 520,
            damping: 14,
            mass: 0.55,
          },
        })
        .then(() =>
          popControls.start({
            scale: 1,
            transition: {
              type: "spring",
              stiffness: 420,
              damping: 20,
              mass: 0.6,
            },
          }),
        );
    };

    const displayLabel = children ?? label;

    return (
      <motion.span
        className="inline-flex"
        initial={{ scale: 1 }}
        animate={popControls}
      >
        <Button
          ref={setButtonRef}
          type={type}
          variant={variant}
          size={size}
          disabled={disabled}
          onClick={handleClick}
          className={className}
          {...props}
        >
          {displayLabel}
        </Button>
      </motion.span>
    );
  },
);

ConfettiButton.displayName = "ConfettiButton";

export default ConfettiButton;