"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

/** One texture pixel, in CSS pixels. Everything snaps to this grid. */
const PX = 3;
/** Stone tile size in texels (Minecraft block textures are 16×16). */
const TILE = 16;

const STONE_BASE = "#7d7d7d";
const STONE_SHADES = ["#747474", "#6a6a6a", "#868686", "#8f8f8f", "#5f5f5f"];

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A seeded 16×16 stone texture, so server and client render the same tile. */
const STONE_TEXTURE = (() => {
  const rand = mulberry32(1337);
  let rects = "";
  for (let y = 0; y < TILE; y++) {
    for (let x = 0; x < TILE; x++) {
      if (rand() < 0.45) continue;
      const shade = STONE_SHADES[Math.floor(rand() * STONE_SHADES.length)]!;
      rects += `<rect x="${x}" y="${y}" width="1" height="1" fill="${shade}"/>`;
    }
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${TILE}" height="${TILE}" shape-rendering="crispEdges"><rect width="${TILE}" height="${TILE}" fill="${STONE_BASE}"/>${rects}</svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
})();

const pixelFont: React.CSSProperties = {
  // Bring your own pixel font through --font-pixel (the docs use Pixelify Sans).
  fontFamily: "var(--font-pixel, ui-monospace), monospace",
};

const stoneStyle: React.CSSProperties = {
  backgroundColor: STONE_BASE,
  backgroundImage: STONE_TEXTURE,
  backgroundSize: `${TILE * PX}px ${TILE * PX}px`,
  imageRendering: "pixelated",
};

/**
 * Pixels of a crack network across a cols×rows grid, ordered so that any
 * prefix is a plausible "earlier" stage: every branch grows one step per round.
 */
function crackOrder(cols: number, rows: number, seed: number) {
  if (cols < 2 || rows < 2) return [] as [number, number][];
  const rand = mulberry32(seed);
  type Walker = { x: number; y: number; a: number; left: number };
  const walkers: Walker[] = [];
  const origins = Math.max(1, Math.round(cols / 24));

  for (let i = 0; i < origins; i++) {
    const ox = ((i + 0.5) / origins) * cols + (rand() - 0.5) * 4;
    const oy = rows / 2 + (rand() - 0.5) * 3;
    const branches = 4 + Math.floor(rand() * 2);
    for (let b = 0; b < branches; b++) {
      walkers.push({
        x: ox,
        y: oy,
        a: (b / branches) * Math.PI * 2 + rand() * 0.8,
        left: 7 + Math.floor(rand() * 12),
      });
    }
  }

  const seen = new Set<number>();
  const order: [number, number][] = [];
  while (walkers.some((w) => w.left > 0)) {
    for (const w of [...walkers]) {
      if (w.left <= 0) continue;
      w.left--;
      w.a += (rand() - 0.5) * 1.1;
      w.x += Math.cos(w.a);
      w.y += Math.sin(w.a) * 0.75;
      const x = Math.round(w.x);
      const y = Math.round(w.y);
      if (x < 0 || y < 0 || x >= cols || y >= rows) {
        w.left = 0;
        continue;
      }
      const key = y * cols + x;
      if (!seen.has(key)) {
        seen.add(key);
        order.push([x, y]);
      }
      if (rand() < 0.12 && w.left > 3) {
        walkers.push({
          x: w.x,
          y: w.y,
          a: w.a + (rand() < 0.5 ? -0.9 : 0.9),
          left: Math.floor(w.left / 2),
        });
      }
    }
  }
  return order;
}

/* ---------- Sound: synthesized, no assets ---------- */

let audioCtx: AudioContext | null = null;

function getAudio() {
  if (typeof window === "undefined") return null;
  if (!audioCtx) {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctor) return null;
    audioCtx = new Ctor();
  }
  if (audioCtx.state === "suspended") void audioCtx.resume();
  return audioCtx;
}

function playNoise(freq: number, duration: number, volume: number, q = 1) {
  const ctx = getAudio();
  if (!ctx) return;
  const length = Math.floor(ctx.sampleRate * duration);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;

  const source = ctx.createBufferSource();
  source.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = freq;
  filter.Q.value = q;
  const gain = ctx.createGain();
  const t = ctx.currentTime;
  gain.gain.setValueAtTime(volume, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + duration);

  source.connect(filter).connect(gain).connect(ctx.destination);
  source.start(t);
}

function playPop() {
  const ctx = getAudio();
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const t = ctx.currentTime;
  const base = 480 + Math.random() * 160;
  osc.type = "triangle";
  osc.frequency.setValueAtTime(base, t);
  osc.frequency.exponentialRampToValueAtTime(base * 2, t + 0.07);
  gain.gain.setValueAtTime(0.16, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
  osc.connect(gain).connect(ctx.destination);
  osc.start(t);
  osc.stop(t + 0.13);
}

const sounds = {
  dig: () => playNoise(900 + Math.random() * 400, 0.08, 0.35, 1.4),
  crack: () => playNoise(520, 0.16, 0.5, 0.9),
  break: () => {
    playNoise(320, 0.38, 0.7, 0.7);
    playNoise(1300, 0.22, 0.3, 1.2);
  },
  pop: playPop,
  place: () => playNoise(240, 0.12, 0.55, 0.8),
};

/* ---------- Particles: pixel chips flung with gravity ---------- */

function spawnChips(
  layer: HTMLElement,
  origin: { x: number; y: number },
  area: { w: number; h: number },
  count: number,
  force: number,
) {
  for (let i = 0; i < count; i++) {
    const chip = document.createElement("span");
    const size = PX * (1 + Math.floor(Math.random() * 2));
    const color =
      Math.random() < 0.3
        ? STONE_BASE
        : STONE_SHADES[Math.floor(Math.random() * STONE_SHADES.length)]!;
    const x0 = origin.x + (Math.random() - 0.5) * area.w;
    const y0 = origin.y + (Math.random() - 0.5) * area.h;
    Object.assign(chip.style, {
      position: "absolute",
      left: `${x0}px`,
      top: `${y0}px`,
      width: `${size}px`,
      height: `${size}px`,
      background: color,
      boxShadow: `inset -1px -1px 0 rgb(0 0 0 / 0.25)`,
    } satisfies Partial<CSSStyleDeclaration>);
    layer.appendChild(chip);

    const vx = (Math.random() - 0.5) * 2 * force;
    const vy = -(0.4 + Math.random()) * force;
    const gravity = 900;
    const duration = 450 + Math.random() * 450;
    const frames: Keyframe[] = [];
    for (let s = 0; s <= 10; s++) {
      const t = (s / 10) * (duration / 1000);
      const dx = Math.round((vx * t) / PX) * PX;
      const dy = Math.round((vy * t + 0.5 * gravity * t * t) / PX) * PX;
      frames.push({
        transform: `translate(${dx}px, ${dy}px)`,
        opacity: s < 7 ? 1 : 1 - (s - 7) / 3,
      });
    }
    chip
      .animate(frames, { duration, easing: "linear", fill: "forwards" })
      .finished.then(
        () => chip.remove(),
        () => chip.remove(),
      );
  }
}

/* ---------- Pickaxe cursor ---------- */

/** 16×16 diamond pickaxe sprite (drawn at 4×, head facing left), inlined so the item stays one file. */
const PICKAXE_SPRITE = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAACmUlEQVR42u1bsUorQRQ9ioUiWCh2GlexeGCTKpWgrQhiwB8QXqEoiM37Bhv9AtFP0M5WQZs0pnwPIaxB3hPCswgEGwubRPaOmtmbuTOzm8zpbnZ2ZvZkztk7d3eBgICBxpDl/iMARQALQv3VAFQBxFITHLFMQHFipXQh2WHzplKWJGDYMgFS/7y1Pm0TkHlwJRCBp+myhTkn+zT2BK4Jbu5sFIimH59fSYO7sXkSzx79IvFb46XrACPTkyQeXZwj8cPWHonbnnDZKwFcCdjQtCmM5jTwHtAPBNRMTmbnAdfV/yTeXpuhs1n/SWJV8/+OT42utnlTuQXQ8aGOCbojIAO4AHAi1Vk/SGDgCDDSvAq2BP7OL5H4TNG8eh8vHOyS+E+lkdRwLxdf9UqAAEQ1bIo8SkAUuhUQgeb+Erm9aC5vCt1eYFPdz+ty+6H9QxKvFqdIrO4drioNo1zeFDoJuMj9ve4vggf4ngA8ewKbAF1u36y3kvf5MoDl5HF179A+/tGm7QnZJSAF1Pv8MvN8p54QPMBy/73k7U49wTYB1d/1VhmJROr86olIQs0T1krTTj3BNgHxF5PPlCcED3A8XuY8gU2Aut9n4pMnwHOe4HoFxMiYJwQP8Dy+d09gE6A+qzOE9zzB9wqI4dkTggdojveiUZO6vXNP0NUEIyhF0YmVElmi3zyrSz0B3Xg/CuNd84Tre1qf4NYYdSsghl6jknX+NOPpwPKE4AHM9rWUv0nBuidw3xGKQDVqu2ChjvfJE0yfO3BXQGzxYtOOJ+oJwQN8T4AJcU/IGwHi9YS8ERBD2BMG3gPyToBxDpI3Cahg1xP6jYAYhp6QdwkYo98ISOMJpI3tj6ZcI0L3Dzq8v5QVEBAQEBCQIbwDjb7c841t6aMAAAAASUVORK5CYII=";

/** The pointer sits on the head's top-left corner (texel 3,2); swings pivot on the grip (texel 14,13). */
const PICKAXE_HOTSPOT = { x: 3.5 * PX, y: 2.5 * PX };
const PICKAXE_GRIP = { x: 14.5 * PX, y: 13.5 * PX };
/** Head lifts back clockwise, then strikes down counter-clockwise. */
const WIND_UP = "rotate(24deg)";
const STRIKE = "rotate(-28deg)";

const pickaxeStyle: React.CSSProperties = {
  width: 16 * PX,
  height: 16 * PX,
  backgroundImage: `url("${PICKAXE_SPRITE}")`,
  backgroundSize: "100% 100%",
  imageRendering: "pixelated",
  transformOrigin: `${PICKAXE_GRIP.x}px ${PICKAXE_GRIP.y}px`,
};

/* ---------- Component ---------- */

export interface MinecraftButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Label used when no children are provided. */
  label?: React.ReactNode;
  /** Taps needed to advance one crack stage. */
  tapsPerStage?: number;
  /** Stages until the button breaks. Breaks after `tapsPerStage * stages` taps. */
  stages?: number;
  /** Play synthesized dig, crack, break, and pickup sounds. */
  sound?: boolean;
  /** Swap the mouse cursor for a pickaxe that swings on each tap. */
  pickaxe?: boolean;
  /** Auto-respawn this many ms after breaking. Omit to wait for the drop to be picked up. */
  respawnAfter?: number;
  /** Fired when the crack deepens to a new stage (1-based). */
  onCrack?: (stage: number) => void;
  /** Fired when the button finally breaks. */
  onBreak?: () => void;
  /** Fired when the button comes back. */
  onRespawn?: () => void;
}

export const MinecraftButton = React.forwardRef<
  HTMLButtonElement,
  MinecraftButtonProps
>(
  (
    {
      children,
      label = "Singleplayer",
      tapsPerStage = 5,
      stages = 4,
      sound = true,
      pickaxe = true,
      respawnAfter,
      onCrack,
      onBreak,
      onRespawn,
      onClick,
      className,
      style,
      disabled,
      type = "button",
      ...props
    },
    ref,
  ) => {
    const buttonRef = React.useRef<HTMLButtonElement | null>(null);
    const layerRef = React.useRef<HTMLSpanElement | null>(null);
    const itemRef = React.useRef<HTMLButtonElement | null>(null);
    const itemBodyRef = React.useRef<HTMLSpanElement | null>(null);
    const [taps, setTaps] = React.useState(0);
    const [broken, setBroken] = React.useState(false);
    const [grid, setGrid] = React.useState({ cols: 0, rows: 0 });
    const [seed, setSeed] = React.useState(7);
    const [aiming, setAiming] = React.useState(false);
    const pointerRef = React.useRef({ x: 0, y: 0 });
    const cursorRef = React.useRef<HTMLDivElement | null>(null);
    const swingRef = React.useRef<HTMLDivElement | null>(null);
    const swingAnim = React.useRef<Animation | undefined>(undefined);

    const placeCursor = React.useCallback((node: HTMLDivElement | null) => {
      cursorRef.current = node;
      if (!node) return;
      const { x, y } = pointerRef.current;
      node.style.transform = `translate(${x - PICKAXE_HOTSPOT.x}px, ${y - PICKAXE_HOTSPOT.y}px)`;
    }, []);

    const swing = (keyframes: Keyframe[], duration: number) => {
      const node = swingRef.current;
      if (!node || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      swingAnim.current?.cancel();
      swingAnim.current = node.animate(keyframes, {
        duration,
        easing: "cubic-bezier(0.3, 0, 0.2, 1)",
        fill: "forwards",
      });
    };

    const trackPointer = (event: React.PointerEvent) => {
      const overButton =
        pickaxe &&
        !broken &&
        !disabled &&
        event.pointerType !== "touch" &&
        !!buttonRef.current?.contains(event.target as Node);
      pointerRef.current = { x: event.clientX, y: event.clientY };
      if (cursorRef.current) placeCursor(cursorRef.current);
      if (overButton !== aiming) setAiming(overButton);
    };

    const perStage = Math.max(1, Math.floor(tapsPerStage));
    const stageCount = Math.max(1, Math.floor(stages));
    const breakAt = perStage * stageCount;
    // The last stage is the break itself, so the visible crack levels stop one short.
    const crackLevels = Math.max(1, stageCount - 1);
    const level = Math.min(Math.floor(taps / perStage), crackLevels);

    const setButtonRef = (node: HTMLButtonElement | null) => {
      buttonRef.current = node;
      if (typeof ref === "function") ref(node);
      else if (ref) ref.current = node;
    };

    React.useEffect(() => {
      const button = buttonRef.current;
      if (!button) return;
      const observer = new ResizeObserver(() => {
        setGrid({
          cols: Math.ceil(button.offsetWidth / PX),
          rows: Math.ceil(button.offsetHeight / PX),
        });
      });
      observer.observe(button);
      return () => observer.disconnect();
    }, []);

    const order = React.useMemo(
      () => crackOrder(grid.cols, grid.rows, seed),
      [grid.cols, grid.rows, seed],
    );
    const visible = order.slice(
      0,
      Math.round((order.length * level) / crackLevels),
    );

    const reduceMotion = () =>
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const respawn = React.useCallback(() => {
      setBroken(false);
      setTaps(0);
      setSeed((s) => s + 1);
      onRespawn?.();
      requestAnimationFrame(() => {
        const button = buttonRef.current;
        if (!button) return;
        button.focus({ preventScroll: true });
        if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
          button.animate(
            [{ transform: "scale(0.9)" }, { transform: "scale(1)" }],
            { duration: 180, easing: "steps(3, end)" },
          );
        }
      });
    }, [onRespawn]);

    const pickUp = () => {
      if (sound) sounds.pop();
      const item = itemRef.current;
      if (item && !reduceMotion()) {
        item
          .animate(
            [
              { transform: "translate(-50%, -50%) scale(1)", opacity: 1 },
              { transform: "translate(-50%, -110%) scale(0.4)", opacity: 0 },
            ],
            { duration: 140, easing: "ease-in", fill: "forwards" },
          )
          .finished.then(respawn, respawn);
      } else {
        respawn();
      }
    };

    // Dropped item: pops out, then bobs and spins like an item entity.
    React.useEffect(() => {
      if (!broken) return;
      itemRef.current?.focus({ preventScroll: true });
      const body = itemBodyRef.current;
      let loop: Animation | undefined;
      let drop: Animation | undefined;
      if (body && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        drop = body.animate(
          [
            { transform: "translateY(0) scale(0.5)" },
            { transform: "translateY(-18px) scale(0.9)", offset: 0.4 },
            { transform: "translateY(0) scale(1)" },
          ],
          { duration: 360, easing: "ease-out" },
        );
        drop.finished.then(
          () => {
            loop = body.animate(
              [
                { transform: "translateY(0) rotateY(0deg)" },
                { transform: "translateY(-5px) rotateY(180deg)" },
                { transform: "translateY(0) rotateY(360deg)" },
              ],
              { duration: 2600, iterations: Infinity, easing: "linear" },
            );
          },
          () => {},
        );
      }
      const timer =
        respawnAfter !== undefined
          ? window.setTimeout(respawn, Math.max(0, respawnAfter))
          : undefined;
      return () => {
        drop?.cancel();
        loop?.cancel();
        window.clearTimeout(timer);
      };
    }, [broken, respawnAfter, respawn]);

    const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
      onClick?.(event);
      if (disabled || broken || event.defaultPrevented) return;

      // Strike from wherever the pointer-down wind-up left the pickaxe.
      if (aiming) {
        swing(
          [
            { transform: WIND_UP },
            { transform: STRIKE, offset: 0.35 },
            { transform: "rotate(0deg)" },
          ],
          240,
        );
      }

      const button = buttonRef.current;
      const layer = layerRef.current;
      const next = taps + 1;
      const nextLevel = Math.min(Math.floor(next / perStage), crackLevels);
      const breaking = next >= breakAt;
      const deepened = !breaking && nextLevel > level;
      const motion = !reduceMotion();

      if (button && layer && motion) {
        const rect = button.getBoundingClientRect();
        // Keyboard clicks report 0,0; chip from the center instead.
        const fromPointer = event.detail > 0;
        const origin = {
          x: fromPointer ? event.clientX - rect.left : rect.width / 2,
          y: fromPointer ? event.clientY - rect.top : rect.height / 2,
        };
        if (breaking) {
          spawnChips(
            layer,
            { x: rect.width / 2, y: rect.height / 2 },
            { w: rect.width, h: rect.height },
            Math.min(90, Math.round(rect.width / 3)),
            260,
          );
        } else {
          spawnChips(
            layer,
            origin,
            { w: 6, h: 6 },
            deepened ? 10 : 4,
            deepened ? 200 : 140,
          );
          const kick = deepened ? 3 : 1.5;
          button.animate(
            [
              { transform: "translate(0, 0)" },
              { transform: `translate(${-kick}px, ${kick / 2}px)` },
              { transform: `translate(${kick}px, 0)` },
              { transform: "translate(0, 0)" },
            ],
            { duration: deepened ? 180 : 110, easing: "steps(4, end)" },
          );
        }
      }

      if (sound) {
        if (breaking) sounds.break();
        else if (deepened) sounds.crack();
        else sounds.dig();
      }

      setTaps(next);
      if (deepened) onCrack?.(nextLevel);
      if (breaking) {
        setBroken(true);
        onBreak?.();
      }
    };

    const content = children ?? label;

    return (
      <span
        className="relative inline-flex align-middle"
        onPointerEnter={trackPointer}
        onPointerMove={trackPointer}
        onPointerLeave={() => setAiming(false)}
        onPointerDown={(event) => {
          trackPointer(event);
          if (aiming) swing([{ transform: WIND_UP }], 90);
        }}
      >
        <button
          ref={setButtonRef}
          type={type}
          disabled={disabled || broken}
          aria-hidden={broken || undefined}
          tabIndex={broken ? -1 : undefined}
          data-stage={level || undefined}
          onClick={handleClick}
          style={{
            ...stoneStyle,
            ...pixelFont,
            ...(aiming ? { cursor: "none" } : null),
            ...style,
          }}
          className={cn(
            "group/mc relative inline-flex h-12 min-w-56 cursor-pointer items-center justify-center rounded-none px-6 outline-none select-none",
            "text-lg leading-none tracking-wide text-[#e0e0e0] [text-shadow:3px_3px_0_#3f3f3f]",
            // Black texel outline with a light top-left bevel and dark bottom-right bevel.
            "shadow-[0_0_0_3px_#000,inset_3px_3px_0_rgb(255_255_255/0.32),inset_-3px_-3px_0_rgb(0_0_0/0.38)]",
            // Hover lights the outline white and turns the label pale yellow, like the Java menus.
            "hover:text-[#ffffa0] hover:shadow-[0_0_0_3px_#fff,inset_3px_3px_0_rgb(255_255_255/0.32),inset_-3px_-3px_0_rgb(0_0_0/0.38)]",
            "focus-visible:text-[#ffffa0] focus-visible:shadow-[0_0_0_3px_#fff,inset_3px_3px_0_rgb(255_255_255/0.32),inset_-3px_-3px_0_rgb(0_0_0/0.38)]",
            // Pressing flips the bevel and sinks the face one texel.
            "active:translate-y-[3px] active:shadow-[0_0_0_3px_#fff,inset_3px_3px_0_rgb(0_0_0/0.38),inset_-3px_-3px_0_rgb(255_255_255/0.2)] motion-reduce:active:translate-y-0",
            "disabled:cursor-not-allowed disabled:text-[#a0a0a0] disabled:brightness-75",
            broken && "invisible",
            className,
          )}
          {...props}
        >
          {visible.length > 0 ? (
            <svg
              aria-hidden
              className="pointer-events-none absolute inset-0 size-full"
              viewBox={`0 0 ${grid.cols} ${grid.rows}`}
              preserveAspectRatio="none"
              shapeRendering="crispEdges"
            >
              {visible.map(([x, y]) => (
                <React.Fragment key={`${x}-${y}`}>
                  <rect x={x} y={y + 1} width={1} height={1} fill="rgb(255 255 255 / 0.14)" />
                  <rect x={x} y={y} width={1} height={1} fill="rgb(16 16 16 / 0.82)" />
                </React.Fragment>
              ))}
            </svg>
          ) : null}
          <span className="relative">{content}</span>
        </button>

        <span
          ref={layerRef}
          aria-hidden
          className="pointer-events-none absolute inset-0 z-10 overflow-visible"
        />

        {/* aiming only turns on from a pointer event, so this never renders on the server. */}
        {aiming
          ? createPortal(
              <div
                ref={placeCursor}
                aria-hidden
                className="pointer-events-none fixed top-0 left-0 z-[90]"
              >
                <div
                  ref={swingRef}
                  className="drop-shadow-[2px_2px_0_rgb(0_0_0/0.25)]"
                  style={pickaxeStyle}
                />
              </div>,
              document.body,
            )
          : null}

        {broken ? (
          <button
            ref={itemRef}
            type="button"
            onClick={pickUp}
            aria-label={typeof content === "string" ? `Pick up ${content}` : "Pick up"}
            className="group/item absolute top-1/2 left-1/2 z-20 grid size-12 -translate-x-1/2 -translate-y-1/2 cursor-pointer place-items-center outline-none [perspective:240px]"
          >
            <span
              ref={itemBodyRef}
              style={stoneStyle}
              className="block size-6 shadow-[0_0_0_2px_#000,inset_2px_2px_0_rgb(255_255_255/0.32),inset_-2px_-2px_0_rgb(0_0_0/0.38)] [transform-style:preserve-3d] group-focus-visible/item:shadow-[0_0_0_2px_#fff,inset_2px_2px_0_rgb(255_255_255/0.32),inset_-2px_-2px_0_rgb(0_0_0/0.38)]"
            />
            <span className="absolute bottom-1 h-1 w-5 bg-black/30" />
            {/* Item tooltip: near-black purple panel with the violet gradient frame. */}
            <span
              style={pixelFont}
              className="pointer-events-none absolute bottom-full left-1/2 mb-1 -translate-x-1/2 border-2 border-[#100010]/95 bg-[#100010]/95 px-1.5 py-1 text-sm leading-none whitespace-nowrap text-white opacity-0 shadow-[inset_0_0_0_1px_#5000ff80] [text-shadow:2px_2px_0_#3f3f3f] group-hover/item:opacity-100 group-focus-visible/item:opacity-100">
              {content}
            </span>
          </button>
        ) : null}
      </span>
    );
  },
);

MinecraftButton.displayName = "MinecraftButton";

export default MinecraftButton;
