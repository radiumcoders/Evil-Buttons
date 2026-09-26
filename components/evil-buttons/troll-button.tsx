"use client";

import * as React from "react";
import {
  AnimatePresence,
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
  useVelocity,
  type AnimationPlaybackControls,
} from "motion/react";
import { cn } from "@/lib/utils";

export interface TrollButtonProps
  extends Omit<
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    "onDrag" | "onDragStart" | "onDragEnd" | "onAnimationStart"
  > {
  /** Label used when no children are provided. */
  label?: React.ReactNode;
  /** Label shown once the button gives up and lets itself be clicked. */
  surrenderLabel?: React.ReactNode;
  /** Milliseconds of chasing before the button gets tired and gives up. */
  giveUpAfter?: number;
  /** How close in px the cursor can get to the button's edge before it dodges. */
  fleeRadius?: number;
  /** Maximum distance in px the button strays from its resting spot. */
  range?: number;
  /** Milliseconds after a successful click before the button starts fleeing again. Set to 0 to stay caught. */
  resetAfter?: number;
}

type TrollState = "fleeing" | "tired";

const DODGE_SPRING = { stiffness: 520, damping: 30, mass: 0.6 };

const labelVariants = {
  enter: { y: 8, opacity: 0 },
  center: { y: 0, opacity: 1 },
  exit: { y: -8, opacity: 0 },
};

const TrollButton = React.forwardRef<HTMLButtonElement, TrollButtonProps>(
  (
    {
      children,
      label = "Click Me",
      surrenderLabel = "Fine, click me",
      giveUpAfter = 3500,
      fleeRadius = 56,
      range = 140,
      resetAfter = 1500,
      onClick,
      onPointerDown,
      className,
      disabled,
      type = "button",
      ...props
    },
    ref,
  ) => {
    const wrapperRef = React.useRef<HTMLSpanElement>(null);
    const offsetRef = React.useRef({ x: 0, y: 0 });
    const staminaRef = React.useRef<AnimationPlaybackControls | null>(null);
    const resetTimerRef = React.useRef<number | undefined>(undefined);
    const [state, setState] = React.useState<TrollState>("fleeing");
    const reduceMotion = useReducedMotion();
    const evasive = state === "fleeing" && !reduceMotion && !disabled;

    const targetX = useMotionValue(0);
    const targetY = useMotionValue(0);
    const x = useSpring(targetX, DODGE_SPRING);
    const y = useSpring(targetY, DODGE_SPRING);
    // Lean into each dodge based on how fast the button is moving sideways.
    const velocityX = useVelocity(x);
    const rotate = useTransform(velocityX, [-2400, 0, 2400], [-10, 0, 10]);
    const stamina = useMotionValue(1);
    const staminaOpacity = useTransform(stamina, (value) => (value < 1 ? 1 : 0));

    const moveTo = React.useCallback(
      (nextX: number, nextY: number) => {
        offsetRef.current = { x: nextX, y: nextY };
        targetX.set(nextX);
        targetY.set(nextY);
      },
      [targetX, targetY],
    );

    const startTiring = React.useCallback(() => {
      if (staminaRef.current) return;
      staminaRef.current = animate(stamina, 0, {
        duration: giveUpAfter / 1000,
        ease: "linear",
        onComplete: () => {
          moveTo(0, 0);
          setState("tired");
        },
      });
    }, [giveUpAfter, moveTo, stamina]);

    const dodge = React.useCallback(
      (pointerX: number, pointerY: number, force = false) => {
        const wrapper = wrapperRef.current;
        if (!wrapper) return;

        // Measure from the resting slot, then add the current offset to find the button.
        const rest = wrapper.getBoundingClientRect();
        const { x: offsetX, y: offsetY } = offsetRef.current;
        const centerX = rest.left + rest.width / 2 + offsetX;
        const centerY = rest.top + rest.height / 2 + offsetY;
        const dx = centerX - pointerX;
        const dy = centerY - pointerY;
        const outsideX = Math.max(Math.abs(dx) - rest.width / 2, 0);
        const outsideY = Math.max(Math.abs(dy) - rest.height / 2, 0);
        const gap = Math.hypot(outsideX, outsideY);

        if (!force && gap >= fleeRadius) return;

        const length = Math.hypot(dx, dy) || 1;
        const push = fleeRadius - gap + 24;
        let nextX = offsetX + (dx / length) * push;
        let nextY = offsetY + (dy / length) * push;
        const rangeY = range * 0.6;

        // Cornered: slip past the cursor to the opposite side of the slot.
        if (Math.abs(nextX) > range || Math.abs(nextY) > rangeY) {
          nextX = -Math.sign(offsetX || dx || 1) * range * 0.7;
          nextY = -offsetY * 0.5;
        }

        moveTo(nextX, nextY);
        startTiring();
      },
      [fleeRadius, moveTo, range, startTiring],
    );

    React.useEffect(() => {
      if (!evasive) return;

      const onPointerMove = (event: PointerEvent) => {
        if (event.pointerType === "touch") return;
        dodge(event.clientX, event.clientY);
      };

      window.addEventListener("pointermove", onPointerMove, { passive: true });
      return () => window.removeEventListener("pointermove", onPointerMove);
    }, [dodge, evasive]);

    React.useEffect(
      () => () => {
        staminaRef.current?.stop();
        window.clearTimeout(resetTimerRef.current);
      },
      [],
    );

    const handlePointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
      onPointerDown?.(event);
      // Touch has no hover to flee from, so tapping triggers a dodge instead.
      if (evasive && event.pointerType === "touch") {
        dodge(event.clientX, event.clientY, true);
      }
    };

    const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
      // Keyboard activation (detail 0) always goes through.
      if (evasive && event.detail !== 0) {
        event.preventDefault();
        return;
      }
      onClick?.(event);

      if (state === "tired" && resetAfter > 0) {
        window.clearTimeout(resetTimerRef.current);
        resetTimerRef.current = window.setTimeout(() => {
          staminaRef.current = null;
          stamina.set(1);
          setState("fleeing");
        }, resetAfter);
      }
    };

    const idleLabel = children ?? label;
    const currentLabel = state === "tired" ? surrenderLabel : idleLabel;

    return (
      <span ref={wrapperRef} className="relative inline-flex">
        <motion.button
          ref={ref}
          type={type}
          disabled={disabled}
          style={{ x, y, rotate }}
          onPointerDown={handlePointerDown}
          onClick={handleClick}
          animate={
            state === "tired" && !reduceMotion
              ? { scaleY: [1, 0.92, 1.03, 1], scaleX: [1, 1.05, 0.98, 1] }
              : undefined
          }
          transition={{ duration: 0.45, ease: "easeOut" }}
          whileTap={state === "tired" ? { scale: 0.96 } : undefined}
          className={cn(
            "relative inline-flex h-9 cursor-pointer items-center justify-center overflow-hidden rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow-[0_1px_2px_rgb(0_0_0/0.14),0_2px_6px_-2px_rgb(0_0_0/0.12),inset_0_1px_0_rgb(255_255_255/0.14),inset_0_-1px_0_rgb(0_0_0/0.12)] outline-none select-none transition-colors hover:bg-primary/90",
            "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50",
            className,
          )}
          {...props}
        >
          <span className="relative inline-grid">
            {/* Invisible copies reserve the wider label so the button never resizes. */}
            <span
              aria-hidden
              className="invisible col-start-1 row-start-1 whitespace-nowrap"
            >
              {idleLabel}
            </span>
            <span
              aria-hidden
              className="invisible col-start-1 row-start-1 whitespace-nowrap"
            >
              {surrenderLabel}
            </span>
            <AnimatePresence initial={false} mode="popLayout">
              <motion.span
                key={state}
                variants={labelVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ type: "spring", stiffness: 420, damping: 30 }}
                className="col-start-1 row-start-1 whitespace-nowrap text-center"
              >
                {currentLabel}
              </motion.span>
            </AnimatePresence>
          </span>

          {/* Stamina drains while the button is being chased. */}
          <motion.span
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 h-0.5 origin-left bg-primary-foreground/50"
            style={{
              scaleX: stamina,
              opacity: state === "fleeing" ? staminaOpacity : 0,
            }}
          />
        </motion.button>
      </span>
    );
  },
);

TrollButton.displayName = "TrollButton";

export { TrollButton };
export default TrollButton;
