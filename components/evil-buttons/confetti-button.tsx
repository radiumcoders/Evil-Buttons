"use client";

import * as React from "react";
import confetti from "canvas-confetti";
import { cn } from "@/lib/utils";

export interface ConfettiButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Label used when no children are provided. */
  label?: React.ReactNode;
  /** Confetti particles per burst. */
  particleCount?: number;
  /** Confetti spread in degrees. */
  spread?: number;
  /** Launch velocity of the burst. */
  startVelocity?: number;
  /** Custom confetti colors. */
  colors?: string[];
  /** Show the leading sparkle icon. */
  icon?: boolean;
  /** Fired after each confetti burst. */
  onCelebrate?: () => void;
}

/** Soft neutrals with a few cool accents, so the burst reads as polish, not a party. */
const CONFETTI_COLORS = ["#fafafa", "#d4d4d4", "#a3a3a3", "#93c5fd", "#c4b5fd", "#fcd34d"];
/** How long the sparkle stays lit after a burst. */
const FIRE_MS = 420;

function burstFromElement(
  element: HTMLElement,
  options: { particleCount: number; spread: number; startVelocity: number; colors: string[] },
) {
  const rect = element.getBoundingClientRect();
  const origin = {
    x: (rect.left + rect.width / 2) / window.innerWidth,
    y: (rect.top + rect.height / 3) / window.innerHeight,
  };

  // One tight burst of small flat pieces that fall and fade quickly.
  void confetti({
    ...options,
    origin,
    angle: 90,
    gravity: 1.1,
    decay: 0.9,
    ticks: 160,
    scalar: 0.75,
    shapes: ["square", "circle"],
    disableForReducedMotion: true,
  });
}

export const ConfettiButton = React.forwardRef<HTMLButtonElement, ConfettiButtonProps>(
  (
    {
      children,
      label = "Continue",
      particleCount = 80,
      spread = 64,
      startVelocity = 32,
      colors = CONFETTI_COLORS,
      icon = true,
      onCelebrate,
      onClick,
      className,
      disabled,
      type = "button",
      ...props
    },
    ref,
  ) => {
    const [firing, setFiring] = React.useState(false);
    const fireTimerRef = React.useRef<number | undefined>(undefined);

    React.useEffect(() => () => window.clearTimeout(fireTimerRef.current), []);

    const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
      onClick?.(event);
      if (disabled || event.defaultPrevented) return;

      burstFromElement(event.currentTarget, { particleCount, spread, startVelocity, colors });
      setFiring(true);
      window.clearTimeout(fireTimerRef.current);
      fireTimerRef.current = window.setTimeout(() => setFiring(false), FIRE_MS);
      onCelebrate?.();
    };

    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled}
        data-firing={firing || undefined}
        onClick={handleClick}
        className={cn(
          "group/confetti inline-flex h-9 cursor-pointer items-center justify-center gap-2 rounded-[10px] px-4 text-sm font-medium text-neutral-50 outline-none select-none",
          // Graded dark surface: dark outer hairline, faint inner ring, top highlight, soft drop.
          "bg-linear-to-b from-[#353535] to-[#272727] shadow-[0_0_0_1px_rgb(0_0_0/0.9),inset_0_0_0_1px_rgb(255_255_255/0.06),inset_0_1px_0_rgb(255_255_255/0.14),0_1px_2px_rgb(0_0_0/0.25),0_4px_12px_-4px_rgb(0_0_0/0.4)]",
          "transition-[scale,filter,box-shadow] duration-300 ease-[cubic-bezier(0.34,1.35,0.64,1)] hover:brightness-110",
          // Press eases in fast and settles the shadow; release springs back on the slower base curve.
          "active:scale-[0.97] active:brightness-95 active:duration-100 active:ease-out active:shadow-[0_0_0_1px_rgb(0_0_0/0.9),inset_0_0_0_1px_rgb(255_255_255/0.05),inset_0_1px_0_rgb(255_255_255/0.08),0_0_1px_rgb(0_0_0/0.2),0_1px_3px_-2px_rgb(0_0_0/0.3)] motion-reduce:active:scale-100",
          "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50",
          icon && "pl-3",
          className,
        )}
        {...props}
      >
        {icon ? (
          <svg
            aria-hidden
            viewBox="0 0 16 16"
            fill="currentColor"
            className={cn(
              "size-3.5 text-neutral-50/45 transition-[rotate,scale,color] duration-300 ease-[cubic-bezier(0.34,1.35,0.64,1)]",
              "group-hover/confetti:rotate-12 group-hover/confetti:text-neutral-50/75",
              "group-data-firing/confetti:scale-125 group-data-firing/confetti:rotate-45 group-data-firing/confetti:text-amber-200 motion-reduce:transform-none",
            )}
          >
            <path d="M8 1.5c.3 2.9 1.6 4.2 4.5 4.5-2.9.3-4.2 1.6-4.5 4.5-.3-2.9-1.6-4.2-4.5-4.5 2.9-.3 4.2-1.6 4.5-4.5Z" />
            <path d="M12.5 10c.15 1.3.7 1.85 2 2-1.3.15-1.85.7-2 2-.15-1.3-.7-1.85-2-2 1.3-.15 1.85-.7 2-2Z" />
          </svg>
        ) : null}
        <span>{children ?? label}</span>
      </button>
    );
  },
);

ConfettiButton.displayName = "ConfettiButton";

export default ConfettiButton;
