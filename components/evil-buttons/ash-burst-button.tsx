"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import {
  Bodies,
  Body,
  Composite,
  Engine,
  World,
} from "matter-js";
import { cn } from "@/lib/utils";

/** Mostly charcoal and ash grey, with a few embers. */
const ASH_COLORS = [
  "#171717",
  "#262626",
  "#404040",
  "#525252",
  "#737373",
  "#a3a3a3",
  "#b91c1c",
  "#f97316",
];
/** How long the ember glow stays on the button after a burst. */
const FIRE_MS = 480;

type ParticleKind = "circle" | "square" | "shard";

type ParticleMeta = {
  color: string;
  kind: ParticleKind;
  size: number;
  born: number;
  life: number;
  glow: boolean;
};

type AshSim = {
  engine: Matter.Engine;
  buttonBody: Matter.Body;
  leftLip: Matter.Body;
  rightLip: Matter.Body;
  meta: Map<number, ParticleMeta>;
  raf: number;
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  startedAt: number;
  lastW: number;
  lastH: number;
};

export interface AshBurstButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Label used when no children are provided. */
  label?: React.ReactNode;
  /** Ash particles per burst. */
  particleCount?: number;
  /** Burst spread in degrees. */
  spread?: number;
  /** Extra launch velocity (mapped into Matter velocity). */
  startVelocity?: number;
  /** Custom ash / ember colors. */
  colors?: string[];
  /** Show the leading ember icon. */
  icon?: boolean;
  /** Fired after each ash burst. */
  onDestroy?: () => void;
}

/** Warm reds and oranges get a soft glow; greys stay flat. */
function isEmber(color: string) {
  const hex = color.replace("#", "");
  if (hex.length < 6) return false;
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  return r > 150 && r > g + 40 && r > b + 60;
}

function pick<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)]!;
}

function drawShard(
  ctx: CanvasRenderingContext2D,
  size: number,
  color: string,
) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, -size);
  ctx.lineTo(size * 0.55, -size * 0.15);
  ctx.lineTo(size * 0.35, size);
  ctx.lineTo(-size * 0.45, size * 0.55);
  ctx.lineTo(-size * 0.2, -size * 0.35);
  ctx.closePath();
  ctx.fill();
}

function sizeCanvas(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = window.innerWidth;
  const h = window.innerHeight;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function syncColliders(sim: AshSim, button: HTMLElement) {
  const rect = button.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const w = Math.max(8, rect.width);
  const h = Math.max(8, rect.height);

  if (sim.lastW > 0 && sim.lastH > 0) {
    const sx = w / sim.lastW;
    const sy = h / sim.lastH;
    if (Math.abs(sx - 1) > 0.005 || Math.abs(sy - 1) > 0.005) {
      Body.scale(sim.buttonBody, sx, sy);
    }
  }

  Body.setPosition(sim.buttonBody, { x: cx, y: cy });

  const lipW = Math.max(10, w * 0.1);
  const lipH = 7;
  Body.setPosition(sim.leftLip, {
    x: rect.left + lipW / 2,
    y: rect.top - lipH / 2 + 1,
  });
  Body.setPosition(sim.rightLip, {
    x: rect.right - lipW / 2,
    y: rect.top - lipH / 2 + 1,
  });

  sim.lastW = w;
  sim.lastH = h;
}

function createAshSimulation(
  canvas: HTMLCanvasElement,
  button: HTMLElement,
  options: {
    particleCount: number;
    spread: number;
    startVelocity: number;
    colors: string[];
  },
): AshSim {
  const ctx = canvas.getContext("2d")!;
  sizeCanvas(canvas, ctx);

  const engine = Engine.create({
    gravity: { x: 0, y: 1.4 },
  });

  const rect = button.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const w = Math.max(8, rect.width);
  const h = Math.max(8, rect.height);

  const buttonBody = Bodies.rectangle(cx, cy, w, h, {
    isStatic: true,
    friction: 1.25,
    frictionStatic: 1.4,
    restitution: 0.18,
    chamfer: { radius: Math.min(8, h / 2) },
    label: "ash-button",
  });

  const lipW = Math.max(10, w * 0.1);
  const lipH = 7;
  const leftLip = Bodies.rectangle(
    rect.left + lipW / 2,
    rect.top - lipH / 2 + 1,
    lipW,
    lipH,
    {
      isStatic: true,
      friction: 1.4,
      restitution: 0.04,
      label: "ash-lip",
    },
  );
  const rightLip = Bodies.rectangle(
    rect.right - lipW / 2,
    rect.top - lipH / 2 + 1,
    lipW,
    lipH,
    {
      isStatic: true,
      friction: 1.4,
      restitution: 0.04,
      label: "ash-lip",
    },
  );

  World.add(engine.world, [buttonBody, leftLip, rightLip]);

  const meta = new Map<number, ParticleMeta>();
  const now = performance.now();
  const count = Math.max(12, options.particleCount);

  for (let i = 0; i < count; i++) {
    const kindRoll = Math.random();
    const kind: ParticleKind =
      kindRoll > 0.75 ? "shard" : kindRoll > 0.4 ? "square" : "circle";

    const size =
      kind === "shard" ? 2.5 + Math.random() * 3 : 1.6 + Math.random() * 2.6;

    const halfSpread = (options.spread * Math.PI) / 180 / 2;
    const angle = -Math.PI / 2 + (Math.random() * 2 - 1) * halfSpread;
    // Balanced kick: readable burst without flying off too hard.
    const speed =
      options.startVelocity * (0.45 + Math.random() * 0.55) * 0.7;

    // Mostly explode from center; a few rain down later to settle on top.
    const rain = Math.random() > 0.72;
    const spawnX = rain
      ? rect.left + Math.random() * w
      : cx + (Math.random() - 0.5) * w * 0.4;
    const spawnY = rain
      ? rect.top - 8 - Math.random() * 28
      : cy + (Math.random() - 0.5) * h * 0.3;

    const body =
      kind === "circle"
        ? Bodies.circle(spawnX, spawnY, size * 0.85, {
            restitution: 0.35 + Math.random() * 0.3,
            friction: 0.65 + Math.random() * 0.4,
            frictionAir: 0.008 + Math.random() * 0.012,
            density: 0.0012,
            label: "ash-particle",
          })
        : Bodies.rectangle(
            spawnX,
            spawnY,
            size * (kind === "shard" ? 1.4 : 1.6),
            size * (kind === "shard" ? 2.2 : 1.6),
            {
              restitution: 0.3 + Math.random() * 0.28,
              friction: 0.7 + Math.random() * 0.4,
              frictionAir: 0.009 + Math.random() * 0.012,
              density: 0.0013,
              angle: Math.random() * Math.PI,
              label: "ash-particle",
            },
          );

    if (rain) {
      Body.setVelocity(body, {
        x: (Math.random() - 0.5) * 3.5,
        y: 1 + Math.random() * 3,
      });
    } else {
      Body.setVelocity(body, {
        x: Math.cos(angle) * speed + (Math.random() - 0.5) * 4,
        y: Math.sin(angle) * speed - (2 + Math.random() * 5),
      });
    }
    Body.setAngularVelocity(body, (Math.random() - 0.5) * 0.55);

    const color = pick(options.colors);
    meta.set(body.id, {
      color,
      glow: isEmber(color),
      kind,
      size,
      born: now,
      life: 3200 + Math.random() * 2200,
    });

    World.add(engine.world, body);
  }

  return {
    engine,
    buttonBody,
    leftLip,
    rightLip,
    meta,
    raf: 0,
    canvas,
    ctx,
    startedAt: now,
    lastW: w,
    lastH: h,
  };
}

function paintSim(sim: AshSim, button: HTMLElement) {
  const { ctx, canvas, engine, meta } = sim;
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;

  syncColliders(sim, button);
  Engine.update(engine, 1000 / 60);

  ctx.clearRect(0, 0, w, h);

  const now = performance.now();
  const toRemove: Matter.Body[] = [];

  for (const body of Composite.allBodies(engine.world)) {
    if (body.label !== "ash-particle") continue;
    const info = meta.get(body.id);
    if (!info) continue;

    const age = now - info.born;
    const fade = Math.max(0, 1 - age / info.life);
    if (
      fade <= 0 ||
      body.position.y > h + 48 ||
      body.position.x < -48 ||
      body.position.x > w + 48
    ) {
      toRemove.push(body);
      continue;
    }

    ctx.save();
    ctx.translate(body.position.x, body.position.y);
    ctx.rotate(body.angle);
    ctx.globalAlpha = 0.4 + fade * 0.6;

    if (info.glow) {
      ctx.globalAlpha = fade * 0.22;
      ctx.fillStyle = info.color;
      ctx.beginPath();
      ctx.arc(0, 0, info.size * 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 0.4 + fade * 0.6;
    }

    if (info.kind === "shard") {
      drawShard(ctx, info.size, info.color);
    } else if (info.kind === "square") {
      ctx.fillStyle = info.color;
      ctx.fillRect(-info.size, -info.size, info.size * 2, info.size * 2);
    } else {
      ctx.fillStyle = info.color;
      ctx.beginPath();
      ctx.arc(0, 0, info.size, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  for (const body of toRemove) {
    meta.delete(body.id);
    World.remove(engine.world, body);
  }

  return meta.size > 0 && now - sim.startedAt < 6500;
}

export const AshBurstButton = React.forwardRef<
  HTMLButtonElement,
  AshBurstButtonProps
>(
  (
    {
      children,
      label = "Delete",
      particleCount = 80,
      spread = 110,
      startVelocity = 42,
      colors = ASH_COLORS,
      icon = true,
      onDestroy,
      onClick,
      className,
      disabled,
      type = "button",
      ...props
    },
    ref,
  ) => {
    const buttonRef = React.useRef<HTMLButtonElement | null>(null);
    const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
    const simRef = React.useRef<AshSim | null>(null);
    const fireTimerRef = React.useRef<number | undefined>(undefined);
    const [simActive, setSimActive] = React.useState(false);
    const [firing, setFiring] = React.useState(false);
    const [mounted, setMounted] = React.useState(false);

    React.useEffect(() => setMounted(true), []);

    const setButtonRef = (node: HTMLButtonElement | null) => {
      buttonRef.current = node;
      if (typeof ref === "function") ref(node);
      else if (ref) ref.current = node;
    };

    const clearSim = (sim: AshSim) => {
      cancelAnimationFrame(sim.raf);
      World.clear(sim.engine.world, false);
      Engine.clear(sim.engine);
      sim.ctx.clearRect(0, 0, sim.canvas.clientWidth, sim.canvas.clientHeight);
    };

    const stopSim = React.useCallback(() => {
      if (simRef.current) clearSim(simRef.current);
      simRef.current = null;
      setSimActive(false);
    }, []);

    React.useEffect(
      () => () => {
        stopSim();
        window.clearTimeout(fireTimerRef.current);
      },
      [stopSim],
    );

    const startPhysicsBurst = () => {
      const button = buttonRef.current;
      const canvas = canvasRef.current;
      if (!button || !canvas) return;

      if (simRef.current) clearSim(simRef.current);
      setSimActive(true);

      const sim = createAshSimulation(canvas, button, {
        particleCount,
        spread,
        startVelocity,
        colors,
      });
      simRef.current = sim;

      const tick = () => {
        const current = simRef.current;
        const btn = buttonRef.current;
        if (!current || !btn) return;

        if (paintSim(current, btn)) {
          current.raf = requestAnimationFrame(tick);
        } else {
          stopSim();
        }
      };

      sim.raf = requestAnimationFrame(tick);
    };

    const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
      onClick?.(event);
      if (disabled || event.defaultPrevented) return;

      const reduceMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      if (!reduceMotion) startPhysicsBurst();

      setFiring(true);
      window.clearTimeout(fireTimerRef.current);
      fireTimerRef.current = window.setTimeout(() => setFiring(false), FIRE_MS);
      onDestroy?.();
    };

    const overlay = mounted
      ? createPortal(
          <canvas
            ref={canvasRef}
            aria-hidden
            className="pointer-events-none fixed inset-0 z-[80]"
            style={{ opacity: simActive ? 1 : 0 }}
          />,
          document.body,
        )
      : null;

    return (
      <>
        {overlay}
        <button
          ref={setButtonRef}
          type={type}
          disabled={disabled}
          data-firing={firing || undefined}
          onClick={handleClick}
          className={cn(
            "group/ash inline-flex h-9 cursor-pointer items-center justify-center gap-2 rounded-[10px] px-4 text-sm font-medium text-neutral-50 outline-none select-none",
            // Graded dark surface: dark outer hairline, faint inner ring, top highlight, soft drop.
            "bg-linear-to-b from-[#353535] to-[#272727] shadow-[0_0_0_1px_rgb(0_0_0/0.9),inset_0_0_0_1px_rgb(255_255_255/0.06),inset_0_1px_0_rgb(255_255_255/0.14),0_1px_2px_rgb(0_0_0/0.25),0_4px_12px_-4px_rgb(0_0_0/0.4)]",
            "transition-[transform,filter,box-shadow] duration-300 ease-[cubic-bezier(0.34,1.35,0.64,1)] hover:brightness-110",
            // Press eases in fast and settles the shadow; release springs back on the slower base curve.
            "active:scale-[0.97] active:brightness-95 active:duration-100 active:ease-out active:shadow-[0_0_0_1px_rgb(0_0_0/0.9),inset_0_0_0_1px_rgb(255_255_255/0.05),inset_0_1px_0_rgb(255_255_255/0.08),0_0_1px_rgb(0_0_0/0.2),0_1px_3px_-2px_rgb(0_0_0/0.3)] motion-reduce:active:scale-100",
            // A burst leaves a faint ember glow on the face that cools back to the idle surface.
            "data-firing:shadow-[0_0_0_1px_rgb(0_0_0/0.9),inset_0_0_0_1px_rgb(249_115_22/0.18),inset_0_1px_0_rgb(255_255_255/0.14),inset_0_-8px_16px_-8px_rgb(239_68_68/0.35),0_1px_2px_rgb(0_0_0/0.25),0_4px_16px_-4px_rgb(239_68_68/0.35)]",
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
                "size-3.5 text-neutral-50/45 transition-[transform,color] duration-300 ease-[cubic-bezier(0.34,1.35,0.64,1)]",
                "group-hover/ash:text-red-400/80",
                "group-data-firing/ash:-translate-y-px group-data-firing/ash:scale-110 group-data-firing/ash:text-orange-400 motion-reduce:transform-none",
              )}
            >
              <path d="M8.6 1.2c.3 2-.6 3.1-1.6 4.2C5.9 6.6 4.5 8 4.5 10.2 4.5 12.6 6.2 14.5 8 14.5s3.5-1.6 3.5-4.1c0-1.5-.6-2.6-1.3-3.4-.1 1.1-.6 1.8-1.4 2.1.5-2.7-.1-5.8-2.2-7.9Z" />
            </svg>
          ) : null}
          <span>{children ?? label}</span>
        </button>
      </>
    );
  },
);

AshBurstButton.displayName = "AshBurstButton";

export default AshBurstButton;
