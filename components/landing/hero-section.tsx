"use client";

import Gravity, { MatterBody } from "@/components/physics/gravity";
import { ButtonPreview } from "@/components/landing/previews";
import { showcase } from "@/components/landing/showcase";
import { ThemeSync } from "@/components/theme-sync";
import { ThemeToggle } from "@/components/theme-toggle";
import { siteConfig } from "@/lib/seo";
import { ArrowUpRight } from "@phosphor-icons/react";
import Link from "next/link";

const matterOptions = {
  friction: 0.45,
  restitution: 0.3,
  density: 0.001,
  isStatic: false,
} as const;

function getDropPosition(index: number) {
  const cols = 6;
  const col = index % cols;
  const row = Math.floor(index / cols);
  const x = `${6 + (col / Math.max(cols - 1, 1)) * 88}%`;
  const y = `${-8 - row * 12}%`;
  const angle = ((index * 41) % 56) - 28;

  return { x, y, angle };
}

export function HeroSection() {
  return (
    <div className="relative h-dvh overflow-hidden bg-background text-foreground">
      <ThemeSync />

      <div className="pointer-events-none relative z-10 flex flex-col gap-4 px-4 py-4 sm:px-6 sm:py-5">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <Link
              href="/"
              className="pointer-events-auto inline-flex items-center gap-2 transition-opacity hover:opacity-85"
            >
              <img
                src="/logo.png"
                alt={siteConfig.name}
                width={288}
                height={192}
                className="h-auto w-9 sm:w-10"
              />
              <span className="font-doto text-base font-black tracking-tighter sm:text-lg">
                Evil Buttons
              </span>
            </Link>
            <p className="max-w-md text-sm text-muted-foreground sm:text-base">
              {siteConfig.tagline}. Grab them, throw them, watch them fall.
            </p>
          </div>

          <div className="pointer-events-auto flex shrink-0 items-center gap-2 sm:gap-3">
            <ThemeToggle />
            <Link
              href="/playground"
              className="hidden text-sm font-medium text-muted-foreground transition-colors hover:text-foreground sm:inline-flex"
            >
              Playground
            </Link>
            <Link
              href="/docs"
              className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Docs
              <ArrowUpRight className="size-3.5" />
            </Link>
          </div>
        </div>

        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground sm:text-[11px]">
          {showcase.length} components — drag to interact
        </p>
      </div>

      <Gravity
        gravity={{ x: 0, y: 1 }}
        addTopWall={false}
        className="inset-0"
      >
        {showcase.map((item, index) => {
          const { x, y, angle } = getDropPosition(index);

          return (
            <MatterBody
              key={item.registryName}
              x={x}
              y={y}
              angle={angle}
              matterBodyOptions={matterOptions}
            >
              <div className="origin-center scale-[0.82] sm:scale-90">
                <ButtonPreview registryName={item.registryName} />
              </div>
            </MatterBody>
          );
        })}
      </Gravity>

      <footer className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground sm:text-[11px] sm:tracking-[0.2em]">
          shadcn registry
        </p>
        <div className="pointer-events-auto flex items-center gap-3 sm:gap-4">
          <Link
            href="/playground"
            className="text-xs font-medium text-muted-foreground transition-colors hover:text-foreground sm:hidden sm:text-sm"
          >
            Playground
          </Link>
          <a
            href={siteConfig.github}
            target="_blank"
            rel="noreferrer"
            className="text-xs font-medium text-muted-foreground transition-colors hover:text-foreground sm:text-sm"
          >
            GitHub
          </a>
        </div>
      </footer>
    </div>
  );
}