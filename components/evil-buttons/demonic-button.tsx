"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export type DemonicButtonVariant = "auto" | "dark" | "light";

// Graded surfaces: outer hairline, faint inner ring, top highlight, soft drop.
// `pressed` settles the shadow while held. `auto` is the light surface on a
// light page and the graphite one under a `.dark` ancestor.
const surfaces: Record<DemonicButtonVariant, { base: string; pressed: string }> = {
  dark: {
    base: "text-neutral-50 from-[#353535] to-[#272727] shadow-[0_0_0_1px_rgb(0_0_0/0.9),inset_0_0_0_1px_rgb(255_255_255/0.06),inset_0_1px_0_rgb(255_255_255/0.14),0_1px_2px_rgb(0_0_0/0.25),0_4px_12px_-4px_rgb(0_0_0/0.4)]",
    pressed:
      "data-holding:shadow-[0_0_0_1px_rgb(0_0_0/0.9),inset_0_0_0_1px_rgb(255_255_255/0.05),inset_0_1px_0_rgb(255_255_255/0.08),0_0_1px_rgb(0_0_0/0.2),0_1px_3px_-2px_rgb(0_0_0/0.3)]",
  },
  light: {
    base: "text-neutral-900 from-white to-neutral-100 shadow-[0_0_0_1px_rgb(0_0_0/0.1),inset_0_1px_0_rgb(255_255_255/0.9),0_1px_2px_rgb(0_0_0/0.06),0_4px_12px_-4px_rgb(0_0_0/0.14)]",
    pressed:
      "data-holding:shadow-[0_0_0_1px_rgb(0_0_0/0.1),inset_0_1px_0_rgb(255_255_255/0.6),0_0_1px_rgb(0_0_0/0.06),0_1px_3px_-2px_rgb(0_0_0/0.12)]",
  },
  auto: {
    base: "text-foreground from-background to-muted shadow-[0_0_0_1px_color-mix(in_oklab,var(--color-foreground)_12%,transparent),inset_0_1px_0_rgb(255_255_255/0.9),0_1px_2px_rgb(0_0_0/0.06),0_4px_12px_-4px_rgb(0_0_0/0.14)] dark:text-neutral-50 dark:from-[#353535] dark:to-[#272727] dark:shadow-[0_0_0_1px_rgb(0_0_0/0.9),inset_0_0_0_1px_rgb(255_255_255/0.06),inset_0_1px_0_rgb(255_255_255/0.14),0_1px_2px_rgb(0_0_0/0.25),0_4px_12px_-4px_rgb(0_0_0/0.4)]",
    pressed:
      "data-holding:shadow-[0_0_0_1px_color-mix(in_oklab,var(--color-foreground)_12%,transparent),inset_0_1px_0_rgb(255_255_255/0.6),0_0_1px_rgb(0_0_0/0.06),0_1px_3px_-2px_rgb(0_0_0/0.12)] dark:data-holding:shadow-[0_0_0_1px_rgb(0_0_0/0.9),inset_0_0_0_1px_rgb(255_255_255/0.05),inset_0_1px_0_rgb(255_255_255/0.08),0_0_1px_rgb(0_0_0/0.2),0_1px_3px_-2px_rgb(0_0_0/0.3)]",
  },
};

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
  /**
   * Charge the button rests at when nobody is holding it, 0 to 0.95. Above 0
   * the horns peek out and embers smolder before the first press.
   */
  idleCharge?: number;
  /**
   * Surface palette. `auto` (default) follows the page theme: light on a light
   * page, graphite under a `.dark` ancestor. `dark` and `light` pin one look.
   */
  variant?: DemonicButtonVariant;
}

/** Extra canvas room around the button so flames can spill past its edges. */
const FIRE_BLEED_X = 40;
const FIRE_HEIGHT = 150;
/** Button height the horn and fire sizes are tuned for; taller buttons scale them up. */
const BASE_HEIGHT = 36;
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

type Ramp = [number, [number, number, number, number]][];

// Blackbody-ish ramp: white-hot core, through orange and red, into smoke.
const FIRE_RAMP_DARK: Ramp = [
  [0, [255, 244, 214, 1]],
  [0.18, [255, 196, 92, 0.95]],
  [0.42, [255, 118, 38, 0.8]],
  [0.68, [206, 48, 24, 0.5]],
  [0.86, [96, 24, 18, 0.22]],
  [1, [40, 20, 20, 0]],
];

// A white-hot core vanishes on a light page, so this ramp starts at saturated
// gold and burns down through red into a sooty smoke that reads on white.
const FIRE_RAMP_LIGHT: Ramp = [
  [0, [255, 196, 56, 1]],
  [0.2, [255, 146, 30, 0.95]],
  [0.42, [238, 80, 24, 0.82]],
  [0.64, [168, 60, 36, 0.34]],
  [0.84, [96, 84, 80, 0.1]],
  [1, [90, 86, 84, 0]],
];

const SPRITE_STEPS = 24;
const SPRITE_SIZE = 64;

function sampleRamp(ramp: Ramp, t: number) {
  for (let i = 1; i < ramp.length; i++) {
    const [t1, c1] = ramp[i];
    if (t <= t1) {
      const [t0, c0] = ramp[i - 1];
      const k = (t - t0) / (t1 - t0);
      return c0.map((v, j) => v + (c1[j] - v) * k) as [
        number,
        number,
        number,
        number,
      ];
    }
  }
  return ramp[ramp.length - 1][1];
}

/** Pre-rendered soft radial blobs, one per step of the fire ramp. */
function createSprites(ramp: Ramp) {
  return Array.from({ length: SPRITE_STEPS }, (_, i) => {
    const [r, g, b, a] = sampleRamp(ramp, i / (SPRITE_STEPS - 1));
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

/** Where flames spawn inside the canvas, and the size multiplier `k`. */
type FireBox = {
  baseY: number;
  left: number;
  right: number;
  center: number;
  k: number;
};

function spawnParticle(
  particles: Particle[],
  box: FireBox,
  intensity: number,
  rand: () => number,
) {
  // Bias spawns toward the middle so the flame has a body.
  const spread = (rand() + rand()) / 2;
  const life = 0.45 + rand() * 0.55 * (0.6 + intensity);
  particles.push({
    x: box.left + spread * (box.right - box.left),
    y: box.baseY + rand() * 6 * box.k,
    vx: (rand() - 0.5) * 18 * box.k,
    vy: -(35 + rand() * 55) * (0.55 + intensity) * box.k,
    age: 0,
    life,
    size: (9 + rand() * 13) * (0.55 + 0.6 * intensity) * box.k,
    seed: rand() * 1000,
  });
}

/** Ages, moves, and culls particles in place. */
function stepParticles(
  particles: Particle[],
  box: FireBox,
  dt: number,
  now: number,
) {
  let alive = 0;
  for (let i = 0; i < particles.length; i++) {
    const p = particles[i];
    p.age += dt;
    if (p.age >= p.life) continue;

    // Buoyancy, a gentle pull to the centerline, and turbulent sway.
    p.vy -= 60 * box.k * dt;
    p.vx += (box.center - p.x) * 0.9 * dt;
    p.vx += Math.sin(now * 0.004 + p.seed) * 40 * box.k * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    particles[alive++] = p;
  }
  particles.length = alive;
}

/** Seeded PRNG, so the reduced-motion flame keeps one shape as it grows. */
function seededRandom(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A frozen frame of a flame at `intensity`, for reduced motion. */
function stillFlame(box: FireBox, intensity: number) {
  const rand = seededRandom(7);
  const particles: Particle[] = [];
  const dt = 1 / 60;
  let debt = 0;
  for (let i = 0; i < 90; i++) {
    debt += dt * (70 + 260 * intensity) * box.k;
    while (debt >= 1) {
      debt -= 1;
      spawnParticle(particles, box, intensity, rand);
    }
    stepParticles(particles, box, dt, i * dt * 1000);
  }
  return particles;
}

// The page theme, read from `.dark` on <html> so canvas colors follow toggles.
function subscribeTheme(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class"],
  });
  return () => observer.disconnect();
}
const getThemeSnapshot = () =>
  document.documentElement.classList.contains("dark");
const getServerThemeSnapshot = () => false;

function Horn({ side, light }: { side: "left" | "right"; light: boolean }) {
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
          {/* A bone tip glows against dark pages; on light ones it would vanish, so it stays warm. */}
          <stop offset="1" stopColor={light ? "#b86a48" : "#e9d6bf"} />
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
      idleCharge = 0,
      variant = "auto",
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
    const spritesRef = React.useRef<{
      dark?: HTMLCanvasElement[];
      light?: HTMLCanvasElement[];
    }>({});
    const stillRef = React.useRef<{ bucket: number; particles: Particle[] }>({
      bucket: -1,
      particles: [],
    });
    const rafRef = React.useRef<number | null>(null);
    const lastTimeRef = React.useRef(0);
    const sizeRef = React.useRef({
      width: 0,
      height: 0,
      dpr: 1,
      bleed: FIRE_BLEED_X,
      k: 1,
    });
    const reduceMotionRef = React.useRef(false);
    const onSummonRef = React.useRef(onSummon);
    const idle = Math.max(0, Math.min(0.95, idleCharge));
    const configRef = React.useRef({ holdDuration, idle });
    const [summoned, setSummoned] = React.useState(false);

    const pageDark = React.useSyncExternalStore(
      subscribeTheme,
      getThemeSnapshot,
      getServerThemeSnapshot,
    );
    const dark = variant === "dark" || (variant === "auto" && pageDark);
    const darkRef = React.useRef(dark);
    const repaintRef = React.useRef<(() => void) | null>(null);
    const surface = surfaces[variant];

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
      // Without motion, start at the idle charge instead of rising into it.
      if (query.matches) progressRef.current = configRef.current.idle;
      const onMotionChange = () => {
        reduceMotionRef.current = query.matches;
      };
      query.addEventListener("change", onMotionChange);

      const resize = () => {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        // Horns and flames grow with the button, so a big CTA gets a big demon.
        const k = Math.max(
          0.5,
          (buttonRef.current?.offsetHeight || BASE_HEIGHT) / BASE_HEIGHT,
        );
        const bleed = FIRE_BLEED_X * k;
        const height = FIRE_HEIGHT * k;
        const width = wrapper.offsetWidth + bleed * 2;
        sizeRef.current = { width, height, dpr, bleed, k };
        stillRef.current.bucket = -1;
        canvas.style.left = `${-bleed}px`;
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
        canvas.width = Math.round(width * dpr);
        canvas.height = Math.round(height * dpr);
        // Resizing clears the canvas, so paint again even if the loop was idle.
        repaintRef.current?.();
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

      const { k } = sizeRef.current;
      const hornY = 26 * (1 - eased) * k;
      const hornScale = (0.55 + 0.45 * eased + pop) * k;
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

      const theme = darkRef.current ? "dark" : "light";
      const sprites = (spritesRef.current[theme] ??= createSprites(
        theme === "dark" ? FIRE_RAMP_DARK : FIRE_RAMP_LIGHT,
      ));
      const { width, height, dpr, bleed, k } = sizeRef.current;
      const box: FireBox = {
        baseY: height - button.offsetHeight / 2,
        left: bleed + 6 * k,
        right: width - bleed - 6 * k,
        center: width / 2,
        k,
      };

      let particles = particlesRef.current;
      if (reduceMotionRef.current) {
        // No flicker: show one frozen flame, rebuilt only as the charge steps up.
        const bucket = intensity > 0.02 ? Math.round(intensity * 20) / 20 : 0;
        if (stillRef.current.bucket !== bucket) {
          stillRef.current = {
            bucket,
            particles: bucket ? stillFlame(box, bucket) : [],
          };
        }
        particles = stillRef.current.particles;
      } else {
        if (intensity > 0.02) {
          spawnDebtRef.current += dt * (70 + 260 * intensity) * k;
          while (spawnDebtRef.current >= 1) {
            spawnDebtRef.current -= 1;
            spawnParticle(particles, box, intensity, Math.random);
          }
        }
        stepParticles(particles, box, dt, now);
      }

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);
      for (const p of particles) {
        const t = p.age / p.life;
        const radius = p.size * (1 - t * 0.55);
        const sprite =
          sprites[Math.min(SPRITE_STEPS - 1, Math.floor(t * SPRITE_STEPS))];
        ctx.globalAlpha = Math.min(1, (1 - t) * 1.4);
        ctx.drawImage(sprite, p.x - radius, p.y - radius, radius * 2, radius * 2);
      }
      ctx.globalAlpha = 1;
    };

    const loop = (now: number) => {
      const last = lastTimeRef.current || now;
      const dt = Math.min((now - last) / 1000, 0.05);
      lastTimeRef.current = now;

      const holding = holdingRef.current;
      const { holdDuration: duration, idle: rest } = configRef.current;
      const step = dt / (Math.max(duration, 1) / 1000);
      const current = progressRef.current;
      // Fill while held; otherwise settle back to the idle charge.
      let progress = holding
        ? current + step
        : current < rest
          ? Math.min(rest, current + step)
          : Math.max(rest, current - step * DRAIN_RATE);
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

      const settled =
        reduceMotionRef.current || particlesRef.current.length === 0;
      if (!holding && progress === rest && (rest === 0 || reduceMotionRef.current) && settled) {
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

    // Keep the loop's settings live, and repaint when the idle charge or theme changes.
    React.useEffect(() => {
      configRef.current = { holdDuration, idle };
      darkRef.current = dark;
      repaintRef.current = ensureLoop;
      ensureLoop();
    });

    const startHold = () => {
      if (disabled) return;
      holdingRef.current = true;
      buttonRef.current?.setAttribute("data-holding", "");
      ensureLoop();
    };

    const stopHold = () => {
      if (!holdingRef.current) return;
      holdingRef.current = false;
      buttonRef.current?.removeAttribute("data-holding");
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
            // Smoke lingers longer against a light page, so fade it out before the canvas edge.
            maskImage: dark
              ? undefined
              : "linear-gradient(to top, black 55%, transparent)",
          }}
        />

        <span
          ref={leftHornRef}
          aria-hidden
          className="pointer-events-none absolute bottom-[45%] left-[14%] z-[1] h-11 w-6 origin-bottom opacity-0"
          style={{ transform: "translateY(26px) rotate(-18deg) scale(0.55)" }}
        >
          <Horn side="left" light={!dark} />
        </span>
        <span
          ref={rightHornRef}
          aria-hidden
          className="pointer-events-none absolute right-[14%] bottom-[45%] z-[1] h-11 w-6 origin-bottom opacity-0"
          style={{ transform: "translateY(26px) rotate(18deg) scale(0.55)" }}
        >
          <Horn side="right" light={!dark} />
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
            "relative z-10 inline-flex h-9 min-w-36 cursor-pointer touch-none items-center justify-center overflow-hidden rounded-[10px] bg-linear-to-b px-5 text-sm font-medium outline-none",
            surface.base,
            // The loop writes `transform` every frame for the tremble, so the press animates the separate `scale` property.
            "transition-[scale,filter,box-shadow] duration-300 ease-[cubic-bezier(0.34,1.35,0.64,1)] hover:brightness-110",
            // Press eases in fast and settles the shadow; release springs back on the slower base curve.
            // data-holding covers pointer, touch, and Space/Enter holds, where :active is unreliable.
            "data-holding:scale-[0.97] data-holding:brightness-95 data-holding:duration-100 data-holding:ease-out motion-reduce:data-holding:scale-100",
            surface.pressed,
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
