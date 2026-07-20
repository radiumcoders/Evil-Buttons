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
import { motion, useAnimationControls, useReducedMotion } from "motion/react";
import { Button } from "@/components/ui/button";

/** Void ash, dried blood, hellfire, bone. */
const ASH_COLORS = [
  "#0a0a0a",
  "#1a0505",
  "#3f0a0a",
  "#7f1d1d",
  "#991b1b",
  "#b91c1c",
  "#dc2626",
  "#ea580c",
  "#f97316",
  "#fef3c7",
];

type ParticleKind = "circle" | "square" | "shard" | "skull";

type ParticleMeta = {
  color: string;
  kind: ParticleKind;
  size: number;
  born: number;
  life: number;
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
  extends Omit<React.ComponentProps<typeof Button>, "onClick"> {
  /** Button label. Falls back to `label` when no children are provided. */
  children?: React.ReactNode;
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
  /** Fired after each ash burst. */
  onDestroy?: () => void;
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
      kindRoll > 0.93
        ? "skull"
        : kindRoll > 0.72
          ? "shard"
          : kindRoll > 0.4
            ? "square"
            : "circle";

    const size =
      kind === "skull"
        ? 10 + Math.random() * 6
        : kind === "shard"
          ? 3.5 + Math.random() * 4
          : 2.2 + Math.random() * 3.8;

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
      kind === "circle" || kind === "skull"
        ? Bodies.circle(spawnX, spawnY, size * (kind === "skull" ? 0.55 : 0.85), {
            restitution: 0.35 + Math.random() * 0.3,
            friction: 0.65 + Math.random() * 0.4,
            frictionAir: 0.008 + Math.random() * 0.012,
            density: kind === "skull" ? 0.0018 : 0.0012,
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

    meta.set(body.id, {
      color: pick(options.colors),
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

    if (info.kind === "skull") {
      ctx.font = `${info.size * 1.8}px serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("💀", 0, 0);
    } else if (info.kind === "shard") {
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

    if (info.color.startsWith("#f") || info.color.startsWith("#e")) {
      ctx.globalAlpha = fade * 0.3;
      ctx.fillStyle = "#f97316";
      ctx.beginPath();
      ctx.arc(0, 0, info.size * 1.7, 0, Math.PI * 2);
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
      label = "Destroy",
      particleCount = 96,
      spread = 120,
      startVelocity = 48,
      colors = ASH_COLORS,
      onDestroy,
      className,
      disabled,
      variant = "destructive",
      size,
      type = "button",
      ...props
    },
    ref,
  ) => {
    const buttonRef = React.useRef<HTMLButtonElement | null>(null);
    const canvasRef = React.useRef<HTMLCanvasElement | null>(null);
    const simRef = React.useRef<AshSim | null>(null);
    const burnControls = useAnimationControls();
    const preferReducedMotion = useReducedMotion();
    const [simActive, setSimActive] = React.useState(false);

    const setButtonRef = (node: HTMLButtonElement | null) => {
      buttonRef.current = node;
      if (typeof ref === "function") ref(node);
      else if (ref) ref.current = node;
    };

    const stopSim = React.useCallback(() => {
      const sim = simRef.current;
      if (!sim) {
        setSimActive(false);
        return;
      }
      cancelAnimationFrame(sim.raf);
      World.clear(sim.engine.world, false);
      Engine.clear(sim.engine);
      sim.ctx.clearRect(0, 0, sim.canvas.clientWidth, sim.canvas.clientHeight);
      simRef.current = null;
      setSimActive(false);
    }, []);

    React.useEffect(() => () => stopSim(), [stopSim]);

    const startPhysicsBurst = React.useCallback(() => {
      const button = buttonRef.current;
      const canvas = canvasRef.current;
      if (!button || !canvas) return;

      const existing = simRef.current;
      if (existing) {
        cancelAnimationFrame(existing.raf);
        World.clear(existing.engine.world, false);
        Engine.clear(existing.engine);
        existing.ctx.clearRect(
          0,
          0,
          existing.canvas.clientWidth,
          existing.canvas.clientHeight,
        );
        simRef.current = null;
      }

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

        const keepGoing = paintSim(current, btn);
        if (keepGoing) {
          current.raf = requestAnimationFrame(tick);
        } else {
          stopSim();
        }
      };

      sim.raf = requestAnimationFrame(tick);
    }, [colors, particleCount, spread, startVelocity, stopSim]);

    const handleClick = () => {
      if (disabled || !buttonRef.current) return;

      if (!preferReducedMotion) {
        startPhysicsBurst();
      }
      onDestroy?.();

      if (preferReducedMotion) return;

      void burnControls
        .start({
          scale: 0.78,
          opacity: 0.35,
          filter:
            "brightness(0.25) contrast(1.6) saturate(2.4) hue-rotate(-12deg)",
          transition: { duration: 0.1, ease: "easeIn" },
        })
        .then(() =>
          burnControls.start({
            scale: 1.12,
            opacity: 1,
            filter: "brightness(1.45) contrast(1.35) saturate(1.8)",
            transition: {
              type: "spring",
              stiffness: 560,
              damping: 12,
              mass: 0.45,
            },
          }),
        )
        .then(() =>
          burnControls.start({
            scale: 1,
            opacity: 1,
            filter: "brightness(1) contrast(1) saturate(1) hue-rotate(0deg)",
            transition: {
              type: "spring",
              stiffness: 360,
              damping: 20,
              mass: 0.55,
            },
          }),
        );
    };

    const displayLabel = children ?? label;
    const [mounted, setMounted] = React.useState(false);

    React.useEffect(() => {
      setMounted(true);
    }, []);

    const overlay =
      mounted && typeof document !== "undefined"
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
        <motion.span
          className="relative inline-flex"
          initial={{
            scale: 1,
            opacity: 1,
            filter: "brightness(1) contrast(1) saturate(1) hue-rotate(0deg)",
          }}
          animate={burnControls}
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
      </>
    );
  },
);

AshBurstButton.displayName = "AshBurstButton";

export default AshBurstButton;
