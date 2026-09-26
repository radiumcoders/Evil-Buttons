"use client";

import * as React from "react";
import {
  motion,
  useMotionTemplate,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from "motion/react";
import { cn } from "@/lib/utils";

export interface StickyButtonProps
  extends Omit<
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    "onDrag" | "onDragStart" | "onDragEnd" | "onAnimationStart"
  > {
  /** Distance in px beyond the button's edge where the pull starts. */
  radius?: number;
  /** How far the body follows the cursor, as a fraction of the cursor offset. */
  strength?: number;
  /** How far the label drifts inside the body, from 0 (fixed) to 1 (edge of the padding). */
  parallax?: number;
  /** Maximum tilt in degrees while the body is pulled. */
  tilt?: number;
}

// Largest label drift at `parallax = 1`, kept inside the button's padding.
const MAX_LABEL_SHIFT = { x: 12, y: 5 };

const BODY_SPRING = { stiffness: 170, damping: 16, mass: 0.6 };
// The label lags a little behind the body so the two layers visibly separate.
const LABEL_SPRING = { stiffness: 120, damping: 14, mass: 0.7 };

/** 1 inside the button, easing smoothly to 0 at the edge of the field. */
function falloff(t: number) {
  if (t <= 0) return 1;
  if (t >= 1) return 0;
  return 1 - t * t * (3 - 2 * t);
}

const StickyButton = React.forwardRef<HTMLButtonElement, StickyButtonProps>(
  (
    {
      children,
      className,
      radius = 120,
      strength = 0.45,
      parallax = 0.35,
      tilt = 8,
      disabled,
      type = "button",
      ...props
    },
    ref,
  ) => {
    const wrapperRef = React.useRef<HTMLSpanElement>(null);
    const reduceMotion = useReducedMotion();

    const pullX = useMotionValue(0);
    const pullY = useMotionValue(0);
    const labelPullX = useMotionValue(0);
    const labelPullY = useMotionValue(0);
    const glowX = useMotionValue(0);
    const glowY = useMotionValue(0);
    const engaged = useMotionValue(0);

    const x = useSpring(pullX, BODY_SPRING);
    const y = useSpring(pullY, BODY_SPRING);
    const labelX = useSpring(labelPullX, LABEL_SPRING);
    const labelY = useSpring(labelPullY, LABEL_SPRING);
    const glowOpacity = useSpring(engaged, { stiffness: 200, damping: 30 });

    const reach = Math.max(radius, 1) * strength;
    const rotateY = useTransform(x, [-reach, reach], [-tilt, tilt]);
    const rotateX = useTransform(y, [-reach, reach], [tilt, -tilt]);
    const glow = useMotionTemplate`radial-gradient(120px circle at ${glowX}px ${glowY}px, color-mix(in oklab, var(--foreground) 12%, transparent), transparent 70%)`;

    React.useEffect(() => {
      if (reduceMotion || disabled) return;

      const release = () => {
        pullX.set(0);
        pullY.set(0);
        labelPullX.set(0);
        labelPullY.set(0);
        engaged.set(0);
      };

      const onPointerMove = (event: PointerEvent) => {
        if (event.pointerType === "touch") return;
        const wrapper = wrapperRef.current;
        if (!wrapper) return;

        // The wrapper never moves, so it is a stable resting frame to measure from.
        const rect = wrapper.getBoundingClientRect();
        const dx = event.clientX - (rect.left + rect.width / 2);
        const dy = event.clientY - (rect.top + rect.height / 2);
        const outsideX = Math.max(Math.abs(dx) - rect.width / 2, 0);
        const outsideY = Math.max(Math.abs(dy) - rect.height / 2, 0);
        const pull = falloff(Math.hypot(outsideX, outsideY) / radius);

        if (pull === 0) {
          release();
          return;
        }

        pullX.set(dx * strength * pull);
        pullY.set(dy * strength * pull);
        const nx = Math.max(-1, Math.min(1, dx / (rect.width / 2)));
        const ny = Math.max(-1, Math.min(1, dy / (rect.height / 2)));
        labelPullX.set(nx * MAX_LABEL_SHIFT.x * parallax * pull);
        labelPullY.set(ny * MAX_LABEL_SHIFT.y * parallax * pull);
        glowX.set(event.clientX - rect.left);
        glowY.set(event.clientY - rect.top);
        engaged.set(pull);
      };

      window.addEventListener("pointermove", onPointerMove, { passive: true });
      document.documentElement.addEventListener("pointerleave", release);
      window.addEventListener("blur", release);
      return () => {
        window.removeEventListener("pointermove", onPointerMove);
        document.documentElement.removeEventListener("pointerleave", release);
        window.removeEventListener("blur", release);
        release();
      };
    }, [
      radius,
      strength,
      parallax,
      reduceMotion,
      disabled,
      pullX,
      pullY,
      labelPullX,
      labelPullY,
      glowX,
      glowY,
      engaged,
    ]);

    return (
      <span
        ref={wrapperRef}
        className="relative inline-flex [perspective:600px]"
      >
        <motion.button
          ref={ref}
          type={type}
          disabled={disabled}
          style={{ x, y, rotateX, rotateY }}
          whileTap={disabled ? undefined : { scale: 0.95 }}
          transition={{ type: "spring", stiffness: 400, damping: 22 }}
          className={cn(
            "relative inline-flex h-9 cursor-pointer items-center justify-center rounded-md border border-dashed border-border bg-background px-4 text-sm font-medium text-foreground shadow-xs outline-none select-none transform-3d",
            "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50",
            className,
          )}
          {...props}
        >
          {/* Soft spotlight that tracks the cursor across the face. */}
          <motion.span
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-[inherit]"
            style={{ backgroundImage: glow, opacity: glowOpacity }}
          />
          <motion.span
            className="relative inline-flex items-center gap-1.5 whitespace-nowrap"
            style={{ x: labelX, y: labelY }}
          >
            {children}
          </motion.span>
        </motion.button>
      </span>
    );
  },
);

StickyButton.displayName = "StickyButton";

export { StickyButton };
export default StickyButton;
