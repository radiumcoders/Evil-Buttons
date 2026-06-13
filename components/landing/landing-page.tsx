"use client";

import { DeferredMount } from "@/components/landing/deferred-mount";
import { FitToContainer } from "@/components/landing/fit-to-container";
import { ThemeSync } from "@/components/theme-sync";
import { siteConfig } from "@/lib/seo";
import { ArrowUpRight, Copy } from "@phosphor-icons/react";
import Link from "next/link";
import { type ReactNode, useEffect, useRef, useState } from "react";

import { AquaButton } from "@/components/evil-buttons/aqua-button";
import { BrutalButton } from "@/components/evil-buttons/brutal-button";
import ChromeButton from "@/components/evil-buttons/chrome-button";
import { ClickPowerUp } from "@/components/evil-buttons/click-powerup";
import { CommandButton } from "@/components/evil-buttons/command-button";
import { CopyButton } from "@/components/evil-buttons/copy-button";
import DitherButton from "@/components/evil-buttons/dither-button";
import EvilEyeButton from "@/components/evil-buttons/evil-eye-button";
import { FrameButton } from "@/components/evil-buttons/frame-button";
import GlitchButton from "@/components/evil-buttons/glitch-button";
import GridButton from "@/components/evil-buttons/grid-button";
import { HighlightButton } from "@/components/evil-buttons/highlight-button";
import { HoldButton } from "@/components/evil-buttons/hold-button";
import MinimalButton from "@/components/evil-buttons/minimal";
import MoviePassButton from "@/components/evil-buttons/movie-pass";
import { RevealButton } from "@/components/evil-buttons/reveal-button";
import ShinyButton from "@/components/evil-buttons/shiny-button";
import StickyButton from "@/components/evil-buttons/sticky";
import { ThreeDButton } from "@/components/evil-buttons/3d-button";
import TrollButton from "@/components/evil-buttons/troll-button";
import { DemonicButton } from "../evil-buttons/demonic-button";

type ButtonShowcase = {
  name: string;
  href: string;
  registryName: string;
  render: () => ReactNode;
};

// Static stand-in shown for the always-on WebGL buttons until their grid cell
// scrolls into view. Approximates the real button's footprint (rounded, dark
// pill) so swapping in the live shader causes no layout shift.
function WebGLPlaceholder({ label }: { label: string }) {
  return (
    <span className="inline-flex min-h-16 min-w-52 items-center justify-center rounded-full border border-border bg-neutral-950 px-9 py-4 font-mono text-sm font-medium uppercase tracking-widest text-neutral-500">
      {label}
    </span>
  );
}

const showcase: ButtonShowcase[] = [
  {
    name: "RevealButton",
    href: "/docs/reveal-button",
    registryName: "reveal-button",
    render: () => <RevealButton label="Hold to reveal" />,
  },
  {
    name: "CommandButton",
    href: "/docs/command-button",
    registryName: "command-button",
    render: () => <CommandButton shortcut="mod+s">Save</CommandButton>,
  },
  {
    name: "CopyButton",
    href: "/docs/copy-button",
    registryName: "copy-button",
    render: () => <CopyButton value="npx evil-buttons@latest init" />,
  },
  {
    name: "ClickPowerUp",
    href: "/docs/click-power-up",
    registryName: "click-powerup",
    render: () => <ClickPowerUp>Doom</ClickPowerUp>,
  },
  {
    name: "DitherButton",
    href: "/docs/dither-button",
    registryName: "dither-button",
    render: () => <DitherButton>Run It</DitherButton>,
  },
  {
    name: "HoldButton",
    href: "/docs/hold-button",
    registryName: "hold-button",
    render: () => <HoldButton />,
  },
  {
    name: "DemonicButton",
    href: "/docs/demonic-button",
    registryName: "demonic-button",
    render: () => <DemonicButton label="Currupt the World" />,
  },
  {
    name: "EvilEyeButton",
    href: "/docs/evil-eye-button",
    registryName: "evil-eye-button",
    render: () => (
      <DeferredMount placeholder={<WebGLPlaceholder label="Doom" />}>
        <EvilEyeButton>Doom</EvilEyeButton>
      </DeferredMount>
    ),
  },
  {
    name: "AquaButton",
    href: "/docs/aqua-button",
    registryName: "aqua-button",
    render: () => <AquaButton>Deploy Doom</AquaButton>,
  },
  {
    name: "BrutalButton",
    href: "/docs/brutal-button",
    registryName: "brutal-button",
    render: () => <BrutalButton>Click Me</BrutalButton>,
  },
  {
    name: "ChromeButton",
    href: "/docs/chrome-button",
    registryName: "chrome-button",
    render: () => (
      <DeferredMount placeholder={<WebGLPlaceholder label="Chromy" />}>
        <ChromeButton>Chromy</ChromeButton>
      </DeferredMount>
    ),
  },
  {
    name: "FrameButton",
    href: "/docs/frame-button",
    registryName: "frame-button",
    render: () => <FrameButton>Deploy</FrameButton>,
  },
  {
    name: "GlitchButton",
    href: "/docs/glitch-button",
    registryName: "glitch-button",
    render: () => <GlitchButton>Launch</GlitchButton>,
  },
  {
    name: "GridButton",
    href: "/docs/grid-button",
    registryName: "grid-button",
    render: () => <GridButton>Click</GridButton>,
  },
  {
    name: "HighlightButton",
    href: "/docs/highlight-button",
    registryName: "highlight-button",
    render: () => <HighlightButton>Send</HighlightButton>,
  },
  {
    name: "MinimalButton",
    href: "/docs/minimal-button",
    registryName: "minimal",
    render: () => <MinimalButton>Apply</MinimalButton>,
  },
  {
    name: "MoviePassButton",
    href: "/docs/movie-pass",
    registryName: "movie-pass",
    render: () => <MoviePassButton>Deploy Doom</MoviePassButton>,
  },
  {
    name: "ShinyButton",
    href: "/docs/shiny-button",
    registryName: "shiny-button",
    render: () => <ShinyButton>Search</ShinyButton>,
  },
  {
    name: "StickyButton",
    href: "/docs/sticky-button",
    registryName: "sticky",
    render: () => <StickyButton>Try to Click</StickyButton>,
  },
  {
    name: "ThreeDButton",
    href: "/docs/3d-button",
    registryName: "3d-button",
    render: () => <ThreeDButton>Continue</ThreeDButton>,
  },
  {
    name: "TrollButton",
    href: "/docs/troll-button",
    registryName: "troll-button",
    render: () => <TrollButton>Click Me</TrollButton>,
  },
];

function ButtonCell({ item }: { item: ButtonShowcase }) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current);
    };
  }, []);

  const command = `npx shadcn@latest add @evilbuttons/${item.registryName}`;

  async function handleCopy(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    await navigator.clipboard.writeText(command);
    setCopied(true);
    if (timerRef.current !== null) clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="group relative flex aspect-square flex-col overflow-hidden border-r border-b border-border bg-background transition-colors hover:bg-muted/30">
      <div className="absolute top-0 left-0 z-10 px-3 py-2 font-mono text-[11px] font-medium text-muted-foreground">
        {item.name}
      </div>
      <div className="flex flex-1 items-center justify-center p-4">
        <FitToContainer>{item.render()}</FitToContainer>
      </div>
      <div className="absolute inset-x-0 bottom-0 flex h-10 translate-y-full gap-px border-t border-border bg-background transition-transform duration-300 ease-[cubic-bezier(0.85,0,0.15,1)] group-hover:translate-y-0">
        <Link
          href={item.href}
          className="flex flex-1 items-center justify-center gap-1 text-[11px] font-medium text-foreground transition-colors hover:bg-muted/50"
        >
          <ArrowUpRight className="size-3" />
          Docs
        </Link>
        <button
          onClick={handleCopy}
          className="flex flex-1 items-center justify-center gap-1 bg-primary text-[11px] font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <Copy className="size-3" weight={copied ? "fill" : "regular"} />
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}

export function LandingPage() {
  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-background text-foreground xl:flex-row">
      <ThemeSync />

      <header className="shrink-0 border-b border-border px-6 py-6 xl:flex xl:w-[340px] xl:shrink-0 xl:flex-col xl:justify-between xl:border-b-0 xl:px-8 xl:py-10">
        <div>
          <Link
            href="/"
            className="inline-flex w-fit transition-opacity hover:opacity-85"
          >
            <div className="flex items-center justify-center gap-2">
              <img
                src="/logo.png"
                alt={siteConfig.name}
                width={288}
                height={192}
                className="h-auto w-14 sm:w-16"
              />
              <h1 className="text-2xl font-doto font-black tracking-tighter leading-5">
                Evil <br /> Buttons
              </h1>
            </div>
          </Link>
          <h1 className="mt-4 max-w-2xl text-2xl font-semibold tracking-tight text-balance leading-tight xl:mt-8 xl:text-3xl">
            Animated buttons, built with an evil touch.
          </h1>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground text-balance xl:mt-4">
            A shadcn/ui registry of {showcase.length} interactive button
            components. Live previews, copy-paste docs, one-command CLI
            installs.
          </p>
          <div className="mt-4 flex items-center gap-2 xl:mt-8 xl:flex-col">
            <Link
              href="/docs"
              className="inline-flex h-9 w-full items-center justify-center bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Browse Docs
            </Link>
            <a
              href={siteConfig.github}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-9 w-full items-center justify-center border border-border bg-background px-4 text-sm font-medium text-foreground transition-colors hover:bg-accent"
            >
              GitHub
            </a>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-4 xl:mt-0 xl:flex-col xl:items-start xl:gap-2">
          <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
            {showcase.length} Components
          </p>
          <p className="font-mono text-[11px] text-muted-foreground">
            © {new Date().getFullYear()} {siteConfig.author.name}
          </p>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto">
        <div className="grid grid-cols-2 border-t border-border md:grid-cols-3 xl:border-l xl:border-t-0">
          {showcase.map((item) => (
            <ButtonCell key={item.name} item={item} />
          ))}
        </div>
      </main>
    </div>
  );
}
