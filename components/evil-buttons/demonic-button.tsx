"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface DemonicButtonProps
  extends Omit<
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    "children" | "onClick"
  > {
  /** Button label. Falls back to `label`. */
  children?: React.ReactNode;
  /** Label used when no children are provided. */
  label?: React.ReactNode;
  /** Milliseconds of holding needed to fully summon the demon. */
  holdDuration?: number;
  /** Fired once each time the charge reaches 100%. */
  onSummon?: () => void;
}

/** Extra canvas room around the button so flames can spill past its edges. */
const FIRE_BLEED_X = 40;
const FIRE_HEIGHT = 150;
/** Charge drains this many times faster than it fills once released. */
const DRAIN_RATE = 2.4;

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  life: number;
  size: number;
  seed: number;
};

// Blackbody-ish ramp: white-hot core, through orange and red, into smoke.
const FIRE_RAMP: [number, [number, number, number, number]][] = [
  [0, [255, 244, 214, 1]],
  [0.18, [255, 196, 92, 0.95]],
  [0.42, [255, 118, 38, 0.8]],
  [0.68, [206, 48, 24, 0.5]],
  [0.86, [96, 24, 18, 0.22]],
  [1, [40, 20, 20, 0]],
];

const SPRITE_STEPS = 24;
const SPRITE_SIZE = 64;

function sampleRamp(t: number) {
  for (let i = 1; i < FIRE_RAMP.length; i++) {
    const [t1, c1] = FIRE_RAMP[i];
    if (t <= t1) {
      const [t0, c0] = FIRE_RAMP[i - 1];
      const k = (t - t0) / (t1 - t0);
      return c0.map((v, j) => v + (c1[j] - v) * k) as [
        number,
        number,
        number,
        number,
      ];
    }
  }
  return FIRE_RAMP[FIRE_RAMP.length - 1][1];
}

/** Pre-rendered soft radial blobs, one per step of the fire ramp. */
function createSprites() {
  return Array.from({ length: SPRITE_STEPS }, (_, i) => {
    const [r, g, b, a] = sampleRamp(i / (SPRITE_STEPS - 1));
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = SPRITE_SIZE;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      const half = SPRITE_SIZE / 2;
      const gradient = ctx.createRadialGradient(half, half, 0, half, half, half);
      gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${a})`);
      gradient.addColorStop(0.45, `rgba(${r}, ${g}, ${b}, ${a * 0.55})`);
      gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, SPRITE_SIZE, SPRITE_SIZE);
    }
    return canvas;
  });
}

function Horn({ side }: { side: "left" | "right" }) {
  const id = React.useId().replace(/:/g, "");
  // Outer edge sweeps out and up to the tip, inner edge curls back to the base.
  const shape =
    "M13 64 C6 50 1.5 33 6.5 15 C8 9.5 10.5 5 13 2 C12.5 12 15 26 21 38 C24.5 45 28.5 53 31 64 Z";

  return (
    <svg
      viewBox="0 0 34 66"
      className={cn("h-full w-full", side === "right" && "-scale-x-100")}
      aria-hidden
    >
      <defs>
        <linearGradient id={`${id}-body`} x1="0.5" y1="1" x2="0.2" y2="0">
          <stop offset="0" stopColor="#1c0907" />
          <stop offset="0.45" stopColor="#4a120d" />
          <stop offset="0.8" stopColor="#8a3a24" />
          <stop offset="1" stopColor="#e9d6bf" />
        </linearGradient>
        <linearGradient id={`${id}-shade`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.18" />
          <stop offset="0.35" stopColor="#ffffff" stopOpacity="0" />
          <stop offset="0.75" stopColor="#000000" stopOpacity="0" />
          <stop offset="1" stopColor="#000000" stopOpacity="0.45" />
        </linearGradient>
        <clipPath id={`${id}-clip`}>
          <path d={shape} />
        </clipPath>
      </defs>
      <path d={shape} fill={`url(#${id}-body)`} />
      <g clipPath={`url(#${id}-clip)`}>
        <rect width="34" height="66" fill={`url(#${id}-shade)`} />
        {/* Growth ridges wrapping around the horn. */}
        <g
          fill="none"
          stroke="#000000"
          strokeOpacity="0.38"
          strokeWidth="0.9"
          strokeLinecap="round"
        >
          <path d="M3 56 Q17 50 32 58" />
          <path d="M2 48 Q15 42 28 49" />
          <path d="M2 40 Q13 35 25 41" />
          <path d="M2.5 32 Q12 28 21.5 33" />
          <path d="M3.5 25 Q11 21.5 18.5 25.5" />
          <path d="M5 18 Q10.5 15.5 16 18.5" />
          <path d="M7 12 Q10.5 10.5 14.5 12.5" />
        </g>
        <path
          d="M8 58 C4 44 3 30 7.5 16"
          fill="none"
          stroke="#ffd9b8"
          strokeOpacity="0.28"
          strokeWidth="1.2"
          strokeLinecap="round"
        />
      </g>
    </svg>
  );
}

export const DemonicButton = React.forwardRef<
  HTMLButtonElement,
  DemonicButtonProps
>(
  (
    {
      children,
      label = "Summon",
      holdDuration = 2200,
      onSummon,
      className,
      disabled,
      type = "button",
      ...props
    },
    ref,
  ) => {
    const wrapperRef = React.useRef<HTMLDivElement>(null);
    const buttonRef = React.useRef<HTMLButtonElement | null>(null);
    const canvasRef = React.useRef<HTMLCanvasElement>(null);
    const glowRef = React.useRef<HTMLSpanElement>(null);
    const leftHornRef = React.useRef<HTMLSpanElement>(null);
    const rightHornRef = React.useRef<HTMLSpanElement>(null);

    const holdingRef = React.useRef(false);
    const progressRef = React.useRef(0);
    const summonedRef = React.useRef(false);
    const particlesRef = React.useRef<Particle[]>([]);
    const spawnDebtRef = React.useRef(0);
    const spritesRef = React.useRef<HTMLCanvasElement[] | null>(null);
    const rafRef = React.useRef<number | null>(null);
    const lastTimeRef = React.useRef(0);
    const sizeRef = React.useRef({ width: 0, height: 0, dpr: 1 });
    const reduceMotionRef = React.useRef(false);
    const onSummonRef = React.useRef(onSummon);
    const [summoned, setSummoned] = React.useState(false);

    React.useEffect(() => {
      onSummonRef.current = onSummon;
    }, [onSummon]);

    const setButtonRef = (node: HTMLButtonElement | null) => {
      buttonRef.current = node;
      if (typeof ref === "function") ref(node);
      else if (ref) ref.current = node;
    };

    // Keep the canvas backing store matched to its CSS size and DPR.
    React.useEffect(() => {
      const wrapper = wrapperRef.current;
      const canvas = canvasRef.current;
      if (!wrapper || !canvas) return;

      const query = window.matchMedia("(prefers-reduced-motion: reduce)");
      reduceMotionRef.current = query.matches;
      const onMotionChange = () => {
        reduceMotionRef.current = query.matches;
      };
      query.addEventListener("change", onMotionChange);

      const resize = () => {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const width = wrapper.offsetWidth + FIRE_BLEED_X * 2;
        sizeRef.current = { width, height: FIRE_HEIGHT, dpr };
        canvas.width = Math.round(width * dpr);
        canvas.height = Math.round(FIRE_HEIGHT * dpr);
      };
      resize();
      const observer = new ResizeObserver(resize);
      observer.observe(wrapper);

      return () => {
        observer.disconnect();
        query.removeEventListener("change", onMotionChange);
        if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      };
    }, []);

    const paint = (progress: number, now: number) => {
      const eased = 1 - Math.pow(1 - progress, 3);
      // Slight overshoot as the horns break free, then settle.
      const pop =
        progress > 0.85 ? Math.sin(((progress - 0.85) / 0.15) * Math.PI) * 0.06 : 0;
      const tremble =
        reduceMotionRef.current || !holdingRef.current || progress >= 1
          ? 0
          : progress * progress;
      const shakeX = (Math.sin(now * 0.09) + Math.sin(now * 0.137)) * 1.2 * tremble;
      const shakeY = Math.cos(now * 0.113) * 0.8 * tremble;

      const hornY = 26 * (1 - eased);
      const hornScale = 0.55 + 0.45 * eased + pop;
      const hornTilt = 18 * (1 - eased);
      if (leftHornRef.current) {
        leftHornRef.current.style.transform = `translateY(${hornY}px) rotate(${-hornTilt}deg) scale(${hornScale})`;
        leftHornRef.current.style.opacity = String(Math.min(1, progress * 3));
      }
      if (rightHornRef.current) {
        rightHornRef.current.style.transform = `translateY(${hornY}px) rotate(${hornTilt}deg) scale(${hornScale})`;
        rightHornRef.current.style.opacity = String(Math.min(1, progress * 3));
      }
      if (buttonRef.current) {
        buttonRef.current.style.transform = `translate(${shakeX}px, ${shakeY}px)`;
      }
      if (glowRef.current) {
        const flicker = reduceMotionRef.current
          ? 0
          : (Math.sin(now * 0.021) + Math.sin(now * 0.047)) * 0.05;
        glowRef.current.style.opacity = String(
          Math.max(0, Math.min(1, eased * 0.9 + flicker * eased)),
        );
      }
    };

    const drawFire = (intensity: number, dt: number, now: number) => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      const button = buttonRef.current;
      if (!canvas || !ctx || !button) return;

      spritesRef.current ??= createSprites();
      const sprites = spritesRef.current;
      const { width, height, dpr } = sizeRef.current;
      const particles = particlesRef.current;
      const baseY = height - button.offsetHeight / 2;
      const left = FIRE_BLEED_X + 6;
      const right = width - FIRE_BLEED_X - 6;
      const center = width / 2;

      if (intensity > 0.02 && !reduceMotionRef.current) {
        spawnDebtRef.current += dt * (70 + 260 * intensity);
        while (spawnDebtRef.current >= 1) {
          spawnDebtRef.current -= 1;
          // Bias spawns toward the middle so the flame has a body.
          const spread = (Math.random() + Math.random()) / 2;
          const life = 0.45 + Math.random() * 0.55 * (0.6 + intensity);
          particles.push({
            x: left + spread * (right - left),
            y: baseY + Math.random() * 6,
            vx: (Math.random() - 0.5) * 18,
            vy: -(35 + Math.random() * 55) * (0.55 + intensity),
            age: 0,
            life,
            size: (9 + Math.random() * 13) * (0.55 + 0.6 * intensity),
            seed: Math.random() * 1000,
          });
        }
      }

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);

      let alive = 0;
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        p.age += dt;
        if (p.age >= p.life) continue;

        // Buoyancy, a gentle pull to the centerline, and turbulent sway.
        p.vy -= 60 * dt;
        p.vx += (center - p.x) * 0.9 * dt;
        p.vx += Math.sin(now * 0.004 + p.seed) * 40 * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        particles[alive++] = p;

        const t = p.age / p.life;
        const radius = p.size * (1 - t * 0.55);
        const sprite = sprites[Math.min(SPRITE_STEPS - 1, Math.floor(t * SPRITE_STEPS))];
        ctx.globalAlpha = Math.min(1, (1 - t) * 1.4);
        ctx.drawImage(sprite, p.x - radius, p.y - radius, radius * 2, radius * 2);
      }
      particles.length = alive;
      ctx.globalAlpha = 1;
    };

    const loop = (now: number) => {
      const last = lastTimeRef.current || now;
      const dt = Math.min((now - last) / 1000, 0.05);
      lastTimeRef.current = now;

      const holding = holdingRef.current;
      const step = dt / (holdDuration / 1000);
      let progress = progressRef.current + (holding ? step : -step * DRAIN_RATE);
      progress = Math.max(0, Math.min(1, progress));
      progressRef.current = progress;

      if (progress >= 1 && !summonedRef.current) {
        summonedRef.current = true;
        setSummoned(true);
        onSummonRef.current?.();
      } else if (progress < 1 && summonedRef.current) {
        summonedRef.current = false;
        setSummoned(false);
      }

      // Flames build slowly, then roar once the demon is summoned.
      const intensity = progress >= 1 ? 1 : Math.pow(progress, 1.6) * 0.85;
      paint(progress, now);
      drawFire(intensity, dt, now);

      if (!holding && progress <= 0 && particlesRef.current.length === 0) {
        rafRef.current = null;
        lastTimeRef.current = 0;
        return;
      }
      rafRef.current = requestAnimationFrame(loop);
    };

    const ensureLoop = () => {
      if (rafRef.current === null) {
        lastTimeRef.current = 0;
        rafRef.current = requestAnimationFrame(loop);
      }
    };

    const startHold = () => {
      if (disabled) return;
      holdingRef.current = true;
      ensureLoop();
    };

    const stopHold = () => {
      if (!holdingRef.current) return;
      holdingRef.current = false;
      ensureLoop();
    };

    return (
      <div ref={wrapperRef} className="relative inline-flex select-none">
        <canvas
          ref={canvasRef}
          aria-hidden
          className="pointer-events-none absolute bottom-1/2 z-0"
          style={{
            left: -FIRE_BLEED_X,
            width: `calc(100% + ${FIRE_BLEED_X * 2}px)`,
            height: FIRE_HEIGHT,
          }}
        />

        <span
          ref={leftHornRef}
          aria-hidden
          className="pointer-events-none absolute bottom-[45%] left-[14%] z-[1] h-11 w-6 origin-bottom opacity-0"
          style={{ transform: "translateY(26px) rotate(-18deg) scale(0.55)" }}
        >
          <Horn side="left" />
        </span>
        <span
          ref={rightHornRef}
          aria-hidden
          className="pointer-events-none absolute right-[14%] bottom-[45%] z-[1] h-11 w-6 origin-bottom opacity-0"
          style={{ transform: "translateY(26px) rotate(18deg) scale(0.55)" }}
        >
          <Horn side="right" />
        </span>

        <button
          ref={setButtonRef}
          type={type}
          disabled={disabled}
          data-state={summoned ? "summoned" : "idle"}
          aria-live="polite"
          onPointerDown={(e) => {
            if (e.button !== 0 && e.pointerType === "mouse") return;
            e.currentTarget.setPointerCapture?.(e.pointerId);
            startHold();
          }}
          onPointerUp={stopHold}
          onPointerCancel={stopHold}
          onLostPointerCapture={stopHold}
          onKeyDown={(e) => {
            if ((e.key === " " || e.key === "Enter") && !e.repeat) {
              e.preventDefault();
              startHold();
            }
          }}
          onKeyUp={(e) => {
            if (e.key === " " || e.key === "Enter") {
              e.preventDefault();
              stopHold();
            }
          }}
          onBlur={stopHold}
          onContextMenu={(e) => e.preventDefault()}
          className={cn(
            "relative z-10 inline-flex h-10 min-w-36 cursor-pointer touch-none items-center justify-center overflow-hidden rounded-lg bg-neutral-950 px-5 text-sm font-medium text-neutral-100 outline-none",
            "shadow-[inset_0_1px_0_rgb(255_255_255/0.08),0_1px_2px_rgb(0_0_0/0.3)] ring-1 ring-white/10",
            "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50",
            className,
          )}
          {...props}
        >
          {/* Ember glow that rises from the bottom as the charge builds. */}
          <span
            ref={glowRef}
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-0"
            style={{
              background:
                "radial-gradient(120% 90% at 50% 130%, rgb(255 140 50 / 0.55), rgb(200 40 20 / 0.28) 45%, transparent 75%)",
            }}
          />
          <span className="relative">{children ?? label}</span>
        </button>
      </div>
    );
  },
);

DemonicButton.displayName = "DemonicButton";

export default DemonicButton;
