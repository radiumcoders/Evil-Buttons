"use client";

/**
 * StretchyButton
 *
 * Original idea and design: "Stretchy button" by Adi (@AdityaSur11)
 * https://x.com/AdityaSur11/status/2117524680412393581
 * This is an independent re-implementation for Evil Buttons.
 */

import * as React from "react";
import {
  animate,
  cancelFrame,
  frame,
  useMotionValue,
  useReducedMotion,
  type AnimationPlaybackControls,
} from "motion/react";
import { cn } from "@/lib/utils";

export interface StretchyButtonProps
  extends Omit<
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    "color" | "onDrag" | "onDragStart" | "onDragEnd" | "onAnimationStart"
  > {
  /** Fill color of the rubber body. */
  color?: string;
  /** How far in px the rubber gives before it stiffens up. */
  stretch?: number;
  /** Drag distance in px at which the button slips out of your grip. */
  snap?: number;
  /** How much it jiggles when let go, from 0 (settles) to 1 (very wobbly). */
  wobble?: number;
}

// Drags shorter than this still count as a click.
const CLICK_SLOP = 6;
// Spacing in px between outline samples.
const OUTLINE_STEP = 5;

type Point = { x: number; y: number };
type Glyph = { el: HTMLSpanElement; x: number; y: number };

/** Evenly spaced points around a pill of the given size, clockwise from the top left. */
function samplePill(width: number, height: number): Point[] {
  const r = Math.min(height, width) / 2;
  const straight = Math.max(0, width - 2 * r);
  const arc = Math.PI * r;
  const perimeter = 2 * straight + 2 * arc;
  const count = Math.max(32, Math.round(perimeter / OUTLINE_STEP));
  const points: Point[] = [];

  for (let i = 0; i < count; i++) {
    let s = (i / count) * perimeter;
    if (s < straight) {
      points.push({ x: r + s, y: 0 });
      continue;
    }
    s -= straight;
    if (s < arc) {
      const a = -Math.PI / 2 + s / r;
      points.push({ x: width - r + Math.cos(a) * r, y: r + Math.sin(a) * r });
      continue;
    }
    s -= arc;
    if (s < straight) {
      points.push({ x: width - r - s, y: height });
      continue;
    }
    s -= straight;
    const a = Math.PI / 2 + s / r;
    points.push({ x: r + Math.cos(a) * r, y: r + Math.sin(a) * r });
  }
  return points;
}

/** Smooth closed path through the points (Catmull-Rom as cubic Béziers). */
function smoothPath(points: Point[]) {
  const n = points.length;
  const f = (v: number) => v.toFixed(2);
  let d = `M${f(points[0].x)} ${f(points[0].y)}`;
  for (let i = 0; i < n; i++) {
    const p0 = points[(i - 1 + n) % n];
    const p1 = points[i];
    const p2 = points[(i + 1) % n];
    const p3 = points[(i + 2) % n];
    d += `C${f(p1.x + (p2.x - p0.x) / 6)} ${f(p1.y + (p2.y - p0.y) / 6)} ${f(
      p2.x - (p3.x - p1.x) / 6,
    )} ${f(p2.y - (p3.y - p1.y) / 6)} ${f(p2.x)} ${f(p2.y)}`;
  }
  return `${d}Z`;
}

/** Splits a plain-text label into per-letter spans so it can bend letter by letter. */
function splitLabel(children: React.ReactNode) {
  if (typeof children !== "string" && typeof children !== "number") return null;
  return Array.from(String(children));
}

const StretchyButton = React.forwardRef<HTMLButtonElement, StretchyButtonProps>(
  (
    {
      children,
      className,
      color = "#3d9df5",
      stretch = 70,
      snap = 220,
      wobble = 0.6,
      disabled,
      type = "button",
      style,
      onClick,
      onPointerDown,
      ...props
    },
    forwardedRef,
  ) => {
    const buttonRef = React.useRef<HTMLButtonElement>(null);
    const pathRef = React.useRef<SVGPathElement>(null);
    const labelRef = React.useRef<HTMLSpanElement>(null);
    React.useImperativeHandle(forwardedRef, () => buttonRef.current!);

    const reduceMotion = useReducedMotion();
    const interactive = !disabled && !reduceMotion;
    const letters = React.useMemo(() => splitLabel(children), [children]);

    // How far the grabbed point has been pulled.
    const dx = useMotionValue(0);
    const dy = useMotionValue(0);
    const [grabbing, setGrabbing] = React.useState(false);

    // Everything the draw loop needs, kept out of React state.
    const shape = React.useRef({
      width: 0,
      height: 0,
      outline: [] as Point[],
      glyphs: [] as Glyph[],
      anchor: { x: 0, y: 0 },
    });
    const drag = React.useRef<{
      pointerId: number;
      startX: number;
      startY: number;
      scale: number;
      moved: boolean;
    } | null>(null);
    const suppressClick = React.useRef(false);
    const springs = React.useRef<AnimationPlaybackControls[]>([]);

    const draw = React.useCallback(() => {
      const { width, height, outline, glyphs, anchor } = shape.current;
      const path = pathRef.current;
      if (!path || !width) return;
      const ox = dx.get();
      const oy = dy.get();

      // A soft gaussian field around the grab point: wide along the button,
      // tall enough that the whole thickness moves together, so a vertical
      // pull bends it like a banana and a sideways pull stretches one end.
      const sx = Math.max(width * 0.55, 36);
      const sy = Math.max(height * 1.6, 36);
      const weight = (x: number, y: number) => {
        const u = (x - anchor.x) / sx;
        const v = (y - anchor.y) / sy;
        return Math.exp(-u * u - v * v);
      };

      path.setAttribute(
        "d",
        smoothPath(
          outline.map((p) => {
            const w = weight(p.x, p.y);
            return { x: p.x + ox * w, y: p.y + oy * w };
          }),
        ),
      );

      // Each letter rides the same field: it moves with it, turns with its
      // slope and widens or narrows with its stretch.
      for (const g of glyphs) {
        const w = weight(g.x, g.y);
        const wx = (w * -2 * (g.x - anchor.x)) / (sx * sx);
        const wy = (w * -2 * (g.y - anchor.y)) / (sy * sy);
        const scaleX = Math.max(0.5, 1 + ox * wx);
        const scaleY = Math.max(0.6, 1 + oy * wy);
        const angle = Math.atan2(oy * wx, 1 + ox * wx);
        g.el.style.transform = `translate(${(ox * w).toFixed(2)}px, ${(oy * w).toFixed(2)}px) rotate(${angle.toFixed(4)}rad) scale(${scaleX.toFixed(3)}, ${scaleY.toFixed(3)})`;
      }
    }, [dx, dy]);

    const measure = React.useCallback(() => {
      const button = buttonRef.current;
      const label = labelRef.current;
      if (!button || !label) return;
      const width = button.offsetWidth;
      const height = button.offsetHeight;
      const s = shape.current;
      s.width = width;
      s.height = height;
      s.outline = samplePill(width, height);
      // Layout offsets ignore transforms, so letters can be measured mid-wobble.
      const parts = letters
        ? (Array.from(label.children) as HTMLSpanElement[])
        : [label];
      s.glyphs = parts.map((el) => {
        let x = el.offsetWidth / 2;
        let y = el.offsetHeight / 2;
        for (let node: HTMLElement | null = el; node && node !== button; ) {
          x += node.offsetLeft;
          y += node.offsetTop;
          node = node.offsetParent as HTMLElement | null;
        }
        return { el, x, y };
      });
      draw();
    }, [draw, letters]);

    React.useLayoutEffect(() => {
      measure();
      const button = buttonRef.current;
      if (!button) return;
      const observer = new ResizeObserver(measure);
      observer.observe(button);
      return () => observer.disconnect();
    }, [measure, children]);

    React.useEffect(() => {
      let queued: ReturnType<typeof frame.render> | null = null;
      const schedule = () => {
        if (queued) return;
        queued = frame.render(() => {
          queued = null;
          draw();
        });
      };
      const offX = dx.on("change", schedule);
      const offY = dy.on("change", schedule);
      return () => {
        offX();
        offY();
        if (queued) cancelFrame(queued);
      };
    }, [draw, dx, dy]);

    const stopSprings = () => {
      for (const s of springs.current) s.stop();
      springs.current = [];
    };

    // Lower damping wobbles longer; the release carries the drag's momentum.
    const springBack = (kick?: { x: number; y: number }) => {
      stopSprings();
      const damping = 6 + (1 - Math.min(1, Math.max(0, wobble))) * 22;
      const options = { type: "spring" as const, stiffness: 420, damping, mass: 0.9 };
      springs.current = [
        animate(dx, 0, kick ? { ...options, velocity: kick.x } : options),
        animate(dy, 0, kick ? { ...options, velocity: kick.y } : options),
      ];
    };

    const release = () => {
      const button = buttonRef.current;
      const current = drag.current;
      if (!current) return;
      drag.current = null;
      setGrabbing(false);
      if (button?.hasPointerCapture(current.pointerId)) {
        button.releasePointerCapture(current.pointerId);
      }
      springBack();
    };

    const handlePointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
      onPointerDown?.(event);
      if (!interactive || event.defaultPrevented || event.button !== 0) return;
      const button = event.currentTarget;
      const rect = button.getBoundingClientRect();
      // Back out ancestor scaling so the pull is in layout pixels.
      const scale = button.offsetWidth / (rect.width || 1);
      shape.current.anchor = {
        x: Math.min(button.offsetWidth, Math.max(0, (event.clientX - rect.left) * scale)),
        y: Math.min(button.offsetHeight, Math.max(0, (event.clientY - rect.top) * scale)),
      };
      stopSprings();
      dx.jump(0);
      dy.jump(0);
      drag.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        scale,
        moved: false,
      };
      suppressClick.current = false;
      button.setPointerCapture(event.pointerId);
      setGrabbing(true);
    };

    const handlePointerMove = (event: React.PointerEvent<HTMLButtonElement>) => {
      const current = drag.current;
      if (!current || event.pointerId !== current.pointerId) return;
      const rawX = (event.clientX - current.startX) * current.scale;
      const rawY = (event.clientY - current.startY) * current.scale;
      const distance = Math.hypot(rawX, rawY);
      if (distance > CLICK_SLOP) {
        current.moved = true;
        suppressClick.current = true;
      }
      if (distance > snap) {
        // Pulled too far: it slips out of your fingers and boings home.
        release();
        return;
      }
      // Rubber: gives easily at first, then stiffens toward `stretch`.
      const give = distance ? (stretch * Math.tanh(distance / stretch)) / distance : 0;
      dx.set(rawX * give);
      dy.set(rawY * give);
    };

    const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
      if (suppressClick.current && event.detail !== 0) {
        // A stretch is not a click.
        suppressClick.current = false;
        event.preventDefault();
        return;
      }
      if (interactive) {
        // A plain press dents the rubber where you hit it and lets it jiggle.
        const button = event.currentTarget;
        const fromKeyboard = event.detail === 0;
        if (fromKeyboard) {
          shape.current.anchor = { x: button.offsetWidth / 2, y: button.offsetHeight / 2 };
        }
        springBack({ x: 0, y: 260 });
      }
      onClick?.(event);
    };

    return (
      <button
        ref={buttonRef}
        type={type}
        disabled={disabled}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={release}
        onPointerCancel={release}
        onLostPointerCapture={release}
        onClick={handleClick}
        style={{
          ...style,
          ["--stretchy-fill" as string]: color,
          ["--stretchy-rim" as string]: `color-mix(in oklab, ${color}, black 14%)`,
        }}
        className={cn(
          "group relative isolate inline-flex h-10 items-center justify-center whitespace-nowrap rounded-full px-5 text-sm font-medium text-white outline-none select-none",
          interactive && (grabbing ? "cursor-grabbing" : "cursor-grab"),
          interactive && "touch-none",
          "disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        {...props}
      >
        <svg
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 size-full overflow-visible"
        >
          <path
            ref={pathRef}
            className="fill-(--stretchy-fill) stroke-(--stretchy-rim) [stroke-width:1.25] group-focus-visible:stroke-ring group-focus-visible:[stroke-width:2.5]"
            style={{ filter: "drop-shadow(0 1px 2px rgb(0 0 0 / 0.12))" }}
          />
        </svg>
        {letters ? (
          <>
            <span className="sr-only">{children}</span>
            <span ref={labelRef} aria-hidden className="inline-flex">
              {letters.map((letter, i) => (
                <span key={i} className="inline-block whitespace-pre will-change-transform">
                  {letter}
                </span>
              ))}
            </span>
          </>
        ) : (
          <span ref={labelRef} className="inline-flex items-center gap-1.5 will-change-transform">
            {children}
          </span>
        )}
      </button>
    );
  },
);

StretchyButton.displayName = "StretchyButton";

export { StretchyButton };
export default StretchyButton;
