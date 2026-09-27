"use client";

import { ArrowUpRight, Check, Copy } from "@phosphor-icons/react";
import {
  AnimatePresence,
  motion,
  useReducedMotion,
  type Variants,
} from "motion/react";
import Link from "next/link";
import {
  type PointerEvent,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { packageCommands } from "@/components/cli-block";
import { FitToContainer } from "@/components/landing/fit-to-container";
import { ShowcasePreview } from "@/components/landing/showcase-preview";
import { showcase, type ShowcaseEntry } from "@/components/landing/showcase";
import { type PackageManager, useConfig } from "@/hooks/use-config";
import { trackOutcome } from "@/lib/tracwell";
import { cn } from "@/lib/utils";

/** How long the carousel sits untouched before rotating. */
const IDLE_MS = 5000;

/** Horizontal travel, in px, that turns a drag into a step. */
const SWIPE_PX = 40;

/** Pointers landing on these drive the button itself, so they never swipe. */
const INTERACTIVE =
  'button:not([data-carousel-step]), a, input, textarea, select, [role="slider"], [role="button"]';

const ease = [0.32, 0.72, 0, 1] as const;

/**
 * Slot offsets from the center card: 0 main, ±1 before/after, ±2 the blurred
 * outer pair. ±3 are the off-stage spots cards enter from and exit to.
 * Together they sit on the face of a cylinder: each step out turns the card
 * further away (`rotate`, degrees) and pushes it back (`z`, px), so the
 * stage's perspective shrinks the far edges. `x` is in card widths.
 */
const slots = [
  { x: 0, z: 0, rotate: 0, scale: 1, opacity: 1, blur: 0 },
  // Scales are matched so each card's inner edge is as tall as its
  // neighbour's facing edge, keeping the top and bottom one smooth arc.
  { x: 0.93, z: -140, rotate: 34, scale: 1, opacity: 1, blur: 0 },
  // Kept shallow: seen from off-axis, perspective adds ~25° of apparent turn,
  // and anything much steeper collapses to a sliver.
  { x: 1.54, z: -300, rotate: 46, scale: 0.86, opacity: 1, blur: 1.5 },
  { x: 2.12, z: -560, rotate: 58, scale: 0.78, opacity: 0, blur: 4 },
];

/**
 * Narrow cards sit under the same perspective as wide ones, which pulls their
 * neighbours in until the gaps close, so phones spread the slots a touch.
 */
const NARROW_SPREAD = 1.08;
const narrowQuery = "(max-width: 639px)";

function useSpread() {
  const narrow = useSyncExternalStore(
    (onChange) => {
      const query = window.matchMedia(narrowQuery);
      query.addEventListener("change", onChange);
      return () => query.removeEventListener("change", onChange);
    },
    () => window.matchMedia(narrowQuery).matches,
    () => false,
  );
  return narrow ? NARROW_SPREAD : 1;
}

function slotStyle(offset: number, spread = 1) {
  const distance = Math.abs(offset);
  const side = Math.sign(offset);
  const slot = slots[distance];
  return {
    x: `${side * slot.x * spread * 100}%`,
    z: slot.z,
    // Turns each side card away from the center, so its inner edge stays
    // nearest the viewer and the stage bulges outward like a drum.
    rotateY: side * slot.rotate,
    scale: slot.scale,
    opacity: slot.opacity,
    filter: `blur(${slot.blur}px)`,
    zIndex: 10 - distance,
  };
}

type Motion = { direction: number; spread: number };

const cardVariants: Variants = {
  // `direction` is +1 when the row shifts left (next), -1 when it shifts right.
  enter: ({ direction, spread }: Motion) => slotStyle(3 * direction, spread),
  exit: ({ direction, spread }: Motion) => slotStyle(-3 * direction, spread),
};

function wrap(index: number) {
  return ((index % showcase.length) + showcase.length) % showcase.length;
}

function VariantPicker({
  variants,
  value,
  onChange,
}: {
  variants: readonly string[];
  value: string;
  onChange: (variant: string) => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Variant"
      className="flex items-center gap-0.5 rounded-lg bg-muted/60 p-0.5"
    >
      {variants.map((variant) => (
        <button
          key={variant}
          type="button"
          role="radio"
          aria-checked={variant === value}
          onClick={() => onChange(variant)}
          className={cn(
            "h-6 rounded-md px-2 text-xs font-medium capitalize transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            variant === value
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {variant}
        </button>
      ))}
    </div>
  );
}

const actionPill =
  "inline-flex h-7 items-center gap-1.5 rounded-full border border-border bg-background/80 px-3 text-xs font-medium text-muted-foreground shadow-[0_1px_2px_rgb(0_0_0/0.04),0_4px_12px_-4px_rgb(0_0_0/0.12)] backdrop-blur-md transition-[color,transform,box-shadow] hover:-translate-y-px hover:text-foreground hover:shadow-[0_1px_2px_rgb(0_0_0/0.05),0_8px_16px_-6px_rgb(0_0_0/0.18)] active:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

function ShowcaseCard({
  item,
  category,
  packageManager,
}: {
  item: ShowcaseEntry;
  category?: string;
  packageManager: PackageManager;
}) {
  const [variant, setVariant] = useState(item.variants?.[0]);
  const [copied, setCopied] = useState(false);
  const copiedTimeout = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(copiedTimeout.current), []);

  const copy = async () => {
    const command = `${packageCommands[packageManager]} @evilbuttons/${item.registryName}`;
    try {
      await navigator.clipboard.writeText(command);
    } catch {
      return;
    }
    setCopied(true);
    trackOutcome("install_command_copied", {
      source: "landing_carousel",
      registry_name: item.registryName,
      package_manager: packageManager,
    });
    window.clearTimeout(copiedTimeout.current);
    copiedTimeout.current = window.setTimeout(() => setCopied(false), 1500);
  };

  return (
    <article className="flex h-full flex-col rounded-xl bg-muted p-1 shadow-[0_24px_48px_-24px_rgb(0_0_0/0.25)] dark:bg-[color-mix(in_oklch,var(--muted)_45%,var(--background))]">
      <header className="flex h-9 shrink-0 items-center justify-between gap-3 pr-1 pl-2.5">
        <h3 className="truncate text-sm font-medium">{item.name}</h3>
      </header>
      <div className="min-h-0 flex-1 overflow-hidden rounded-lg border border-border bg-background">
        <div className="relative h-full px-6 pt-8 pb-14">
          {category ? (
            <span className="absolute top-3 left-3 font-mono text-[10px] tracking-[0.18em] text-muted-foreground uppercase">
              {category}
            </span>
          ) : null}
          {item.variants && variant ? (
            <div className="absolute top-2 right-2 z-10">
              <VariantPicker
                variants={item.variants}
                value={variant}
                onChange={setVariant}
              />
            </div>
          ) : null}
          <FitToContainer key={variant}>
            <ShowcasePreview
              registryName={item.registryName}
              variant={variant}
            />
          </FitToContainer>
          <div className="absolute inset-x-0 bottom-3 z-10 flex justify-center gap-2">
            <Link href={item.href} className={actionPill}>
              Docs
              <ArrowUpRight className="size-3" />
            </Link>
            <button type="button" onClick={copy} className={actionPill}>
              {copied ? (
                <Check className="size-3" weight="bold" />
              ) : (
                <Copy className="size-3" />
              )}
              {copied ? "Copied" : "Copy command"}
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}

/** Soft blurred light behind the stage: brand red in the middle, foreground at the sides. */
function GlowBackdrop() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 1200 600"
      preserveAspectRatio="xMidYMid slice"
      className="pointer-events-none absolute inset-x-0 -top-24 -bottom-24 -z-0 mx-auto h-[calc(100%+12rem)] w-full max-w-6xl text-foreground"
    >
      <defs>
        <filter id="showcase-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="70" />
        </filter>
      </defs>
      <g filter="url(#showcase-glow)" fill="currentColor">
        <ellipse
          cx="600"
          cy="330"
          rx="260"
          ry="150"
          opacity="0.1"
          fill="currentColor"
          className="text-brand"
        />
        <ellipse cx="380" cy="380" rx="170" ry="100" opacity="0.04" />
        <ellipse cx="820" cy="380" rx="170" ry="100" opacity="0.04" />
      </g>
    </svg>
  );
}

/**
 * Five live cards — two before, the main one, two after. Left idle, the row drifts right:
 * the main card shrinks into the after slot, the before card grows into the
 * middle, and the next one slides in behind it. Hovering or focusing the
 * stage holds the rotation; only the main card is interactive.
 */
export function ShowcaseCarousel({
  categories,
}: {
  categories: Record<string, string | undefined>;
}) {
  const [{ active, direction }, setState] = useState({
    active: 0,
    direction: -1,
  });
  const [held, setHeld] = useState(false);
  const reducedMotion = useReducedMotion();
  const { packageManager } = useConfig();
  const spread = useSpread();
  const custom: Motion = { direction, spread };
  const autoplay = !held && !reducedMotion;

  const step = (delta: number) =>
    setState((prev) => ({ active: wrap(prev.active + delta), direction: Math.sign(delta) }));

  const swipeStart = useRef<{ x: number; y: number } | null>(null);
  // Set when a drag ends on a side card, so its click doesn't step again.
  const swiped = useRef(false);

  const onPointerDown = (event: PointerEvent) => {
    swiped.current = false;
    if (event.button !== 0 || (event.target as Element).closest(INTERACTIVE)) return;
    swipeStart.current = { x: event.clientX, y: event.clientY };
  };

  const onPointerUp = (event: PointerEvent) => {
    const start = swipeStart.current;
    swipeStart.current = null;
    if (!start) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (Math.abs(dx) < SWIPE_PX || Math.abs(dx) < Math.abs(dy)) return;
    swiped.current = true;
    step(dx < 0 ? 1 : -1);
  };

  // Restarts on every move, so the idle clock always counts from the last one.
  useEffect(() => {
    if (!autoplay) return;
    const timeout = window.setTimeout(() => step(-1), IDLE_MS);
    return () => window.clearTimeout(timeout);
  }, [autoplay, active]);

  const visible = [-2, -1, 0, 1, 2].map((offset) => ({
    offset,
    item: showcase[wrap(active + offset)],
  }));

  return (
    <div className="relative h-full w-full">
      <GlowBackdrop />
      <div
        role="region"
        aria-roledescription="carousel"
        aria-label="Button showcase"
        onPointerEnter={() => setHeld(true)}
        onPointerLeave={() => setHeld(false)}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={() => (swipeStart.current = null)}
        onFocus={() => setHeld(true)}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) setHeld(false);
        }}
        className="relative mx-auto grid h-full w-[min(30rem,calc(100vw-3rem))] touch-pan-y grid-rows-[minmax(0,1fr)] items-center select-none [perspective:1400px]"
      >
        <AnimatePresence initial={false} custom={custom}>
          {visible.map(({ offset, item }) => {
            const main = offset === 0;

            return (
              <motion.div
                key={item.registryName}
                custom={custom}
                variants={cardVariants}
                initial="enter"
                animate={slotStyle(offset, spread)}
                exit="exit"
                transition={{ duration: 0.8, ease }}
                style={{ transformOrigin: "50% 50%" }}
                className="relative h-full max-h-[27rem] [grid-area:1/1]"
                aria-hidden={!main}
              >
                <div inert={!main} className="h-full">
                  <ShowcaseCard
                    item={item}
                    category={categories[item.href]}
                    packageManager={packageManager}
                  />
                </div>
                {!main ? (
                  <button
                    type="button"
                    tabIndex={-1}
                    data-carousel-step
                    onClick={() => {
                      if (!swiped.current) step(offset);
                    }}
                    className="absolute inset-0 cursor-pointer rounded-xl"
                    aria-label={`Show ${item.name}`}
                  />
                ) : null}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
