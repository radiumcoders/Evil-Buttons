"use client";

import { ArrowUpRight, CaretLeft, CaretRight } from "@phosphor-icons/react";
import {
  AnimatePresence,
  motion,
  useReducedMotion,
  type Variants,
} from "motion/react";
import Link from "next/link";
import { useState } from "react";
import { packageCommands, PackageManagerTabs } from "@/components/cli-block";
import CopyButton from "@/components/copy-button";
import { FitToContainer } from "@/components/landing/fit-to-container";
import { ShowcasePreview } from "@/components/landing/showcase-preview";
import { showcase, type ShowcaseEntry } from "@/components/landing/showcase";
import { type PackageManager, useConfig } from "@/hooks/use-config";
import { cn } from "@/lib/utils";

/** How long the carousel sits untouched before rotating. */
const IDLE_MS = 5000;

const ease = [0.32, 0.72, 0, 1] as const;

/**
 * Slot offsets from the center card: -1 before, 0 main, 1 after. ±2 are the
 * off-stage spots cards enter from and exit to.
 */
function slotStyle(offset: number) {
  const distance = Math.abs(offset);
  return {
    x: `${offset * 96}%`,
    scale: distance === 0 ? 1 : distance === 1 ? 0.82 : 0.7,
    opacity: distance === 0 ? 1 : distance === 1 ? 0.5 : 0,
    zIndex: 10 - distance,
  };
}

const cardVariants: Variants = {
  // `direction` is +1 when the row shifts left (next), -1 when it shifts right.
  enter: (direction: number) => slotStyle(2 * direction),
  slot: (offset: number) => slotStyle(offset),
  exit: (direction: number) => slotStyle(-2 * direction),
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
  const command = `${packageCommands[packageManager]} @evilbuttons/${item.registryName}`;

  return (
    <article className="rounded-xl bg-muted/50 p-1 shadow-[0_24px_48px_-24px_rgb(0_0_0/0.25)] dark:bg-muted/25">
      <header className="flex h-9 items-center justify-between gap-3 pr-1 pl-2.5">
        <h3 className="truncate text-sm font-medium">{item.name}</h3>
        <Link
          href={item.href}
          className="inline-flex h-7 shrink-0 items-center gap-1 rounded-md px-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          Docs
          <ArrowUpRight className="size-3" />
        </Link>
      </header>
      <div className="overflow-hidden rounded-lg border border-border bg-background">
        <div className="relative h-72 p-6 sm:h-80">
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
        </div>
        <div className="flex items-center gap-2 border-t border-border py-1 pr-1 pl-3">
          <code className="docs-scroll min-w-0 flex-1 overflow-x-auto font-mono text-xs whitespace-nowrap text-foreground/80">
            {command}
          </code>
          <CopyButton
            className="shrink-0"
            code={command}
            outcome={{
              name: "install_command_copied",
              properties: {
                source: "landing_carousel",
                registry_name: item.registryName,
                package_manager: packageManager,
              },
            }}
          />
        </div>
      </div>
    </article>
  );
}

/**
 * Three live cards — before, main, after. Left idle, the row drifts right:
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
  const { packageManager, setConfig } = useConfig();
  const autoplay = !held && !reducedMotion;

  const step = (delta: number) =>
    setState((prev) => ({ active: wrap(prev.active + delta), direction: delta }));

  const slots = [-1, 0, 1].map((offset) => ({
    offset,
    item: showcase[wrap(active + offset)],
  }));

  return (
    <div className="w-full">
      <div
        role="region"
        aria-roledescription="carousel"
        aria-label="Button showcase"
        onPointerEnter={() => setHeld(true)}
        onPointerLeave={() => setHeld(false)}
        onFocus={() => setHeld(true)}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) setHeld(false);
        }}
        className="mx-auto grid w-[min(26rem,calc(100vw-3rem))] items-end"
      >
        <AnimatePresence initial={false} custom={direction}>
          {slots.map(({ offset, item }) => {
            const main = offset === 0;

            return (
              <motion.div
                key={item.registryName}
                custom={direction}
                variants={cardVariants}
                initial="enter"
                animate={slotStyle(offset)}
                exit="exit"
                transition={{ duration: 0.8, ease }}
                style={{ transformOrigin: "50% 100%" }}
                className="relative [grid-area:1/1]"
                aria-hidden={!main}
              >
                <div inert={!main}>
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
                    onClick={() => step(offset)}
                    className="absolute inset-0 cursor-pointer rounded-xl"
                    aria-label={`Show ${item.name}`}
                  />
                ) : null}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      <div className="mx-auto mt-6 w-[min(26rem,calc(100vw-3rem))]">
        <div className="h-px overflow-hidden bg-border">
          {autoplay ? (
            <motion.div
              key={active}
              className="h-full origin-left bg-foreground/60"
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ duration: IDLE_MS / 1000, ease: "linear" }}
              onAnimationComplete={() => step(-1)}
            />
          ) : null}
        </div>
        <div className="mt-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => step(-1)}
              aria-label="Previous button"
              className="inline-flex size-8 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <CaretLeft className="size-3.5" weight="bold" />
            </button>
            <button
              type="button"
              onClick={() => step(1)}
              aria-label="Next button"
              className="inline-flex size-8 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <CaretRight className="size-3.5" weight="bold" />
            </button>
            <p
              aria-live="polite"
              className="ml-2 font-mono text-[11px] tabular-nums text-muted-foreground"
            >
              {String(active + 1).padStart(2, "0")} /{" "}
              {String(showcase.length).padStart(2, "0")}
            </p>
          </div>
          <PackageManagerTabs
            value={packageManager}
            onChange={(manager) => setConfig({ packageManager: manager })}
          />
        </div>
      </div>
    </div>
  );
}
