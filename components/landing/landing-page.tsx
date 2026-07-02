"use client";

import { DeferredMount } from "@/components/landing/deferred-mount";
import { FitToContainer } from "@/components/landing/fit-to-container";
import { ThemeSync } from "@/components/theme-sync";
import { siteConfig } from "@/lib/seo";
import { ArrowUpRight } from "@phosphor-icons/react";
import Link from "next/link";
import { type ReactNode, useState } from "react";

import { AquaButton } from "@/components/evil-buttons/aqua-button";
import { BrutalButton } from "@/components/evil-buttons/brutal-button";
import { CaptchaButton } from "@/components/evil-buttons/captcha-button";
import ChromeButton from "@/components/evil-buttons/chrome-button";
import { ClickPowerUp } from "@/components/evil-buttons/click-powerup";
import { CommandButton } from "@/components/evil-buttons/command-button";
import { CooldownButton } from "@/components/evil-buttons/cooldown-button";
import { CopyButton } from "@/components/evil-buttons/copy-button";
import { DoubtButton } from "@/components/evil-buttons/doubt-button";
import DitherButton from "@/components/evil-buttons/dither-button";
import EvilEyeButton from "@/components/evil-buttons/evil-eye-button";
import { FrameButton } from "@/components/evil-buttons/frame-button";
import GlitchButton from "@/components/evil-buttons/glitch-button";
import GridButton from "@/components/evil-buttons/grid-button";
import { HighlightButton } from "@/components/evil-buttons/highlight-button";
import { HoldButton } from "@/components/evil-buttons/hold-button";
import MinimalButton from "@/components/evil-buttons/minimal";
import { MorphStatusButton } from "@/components/evil-buttons/morph-status-button";
import MoviePassButton from "@/components/evil-buttons/movie-pass";
import { RevealButton } from "@/components/evil-buttons/reveal-button";
import ShinyButton from "@/components/evil-buttons/shiny-button";
import { SlideToDetonate } from "@/components/evil-buttons/slide-to-detonate";
import StickyButton from "@/components/evil-buttons/sticky";
import { ThreeDButton } from "@/components/evil-buttons/3d-button";
import TrollButton from "@/components/evil-buttons/troll-button";
import { DemonicButton } from "../evil-buttons/demonic-button";
import { PillButton } from "@/components/evil-buttons/pill-button";
import { ConfettiButton } from "@/components/evil-buttons/confetti-button";
import { HoldConfirmButton } from "@/components/evil-buttons/hold-confirm-button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type ButtonShowcase = {
  name: string;
  href: string;
  registryName: string;
  render: () => ReactNode;
};

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
  {
    name: "CaptchaButton",
    href: "/docs/captcha-button",
    registryName: "captcha-button",
    render: () => <CaptchaButton>Deploy Doom</CaptchaButton>,
  },
  {
    name: "DoubtButton",
    href: "/docs/doubt-button",
    registryName: "doubt-button",
    render: () => <DoubtButton>Delete everything</DoubtButton>,
  },
  {
    name: "SlideToDetonate",
    href: "/docs/slide-to-detonate",
    registryName: "slide-to-detonate",
    render: () => <SlideToDetonate>Slide to detonate</SlideToDetonate>,
  },
  {
    name: "MorphStatusButton",
    href: "/docs/morph-status-button",
    registryName: "morph-status-button",
    render: () => (
      <MorphStatusButton
        onClick={() => new Promise((resolve) => setTimeout(resolve, 1200))}
      >
        Save changes
      </MorphStatusButton>
    ),
  },
  {
    name: "CooldownButton",
    href: "/docs/cooldown-button",
    registryName: "cooldown-button",
    render: () => <CooldownButton>Send it</CooldownButton>,
  },
  {
    name: "PillButton",
    href: "/docs/pill-button",
    registryName: "pill-button",
    render: () => (
      <PillButton
        primaryLabel="Off"
        secondaryLabel="On"
        primaryClassName="bg-neutral-950 text-neutral-200"
        secondaryClassName="bg-primary text-primary-foreground"
      />
    ),
  },
  {
    name: "ConfettiButton",
    href: "/docs/confetti-button",
    registryName: "confetti-button",
    render: () => <ConfettiButton>Celebrate</ConfettiButton>,
  },
  {
    name: "HoldConfirmButton",
    href: "/docs/hold-confirm-button",
    registryName: "hold-confirm-button",
    render: () => <HoldConfirmButton />,
  },
];

export function LandingPage() {
  const [selected, setSelected] = useState(showcase[0].registryName);
  const active = showcase.find((item) => item.registryName === selected) ?? showcase[0];

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-background text-foreground">
      <ThemeSync />

      <header className="flex shrink-0 items-center justify-between gap-4 border-b border-border px-6 py-4">
        <Link
          href="/"
          className="inline-flex w-fit items-center gap-2 transition-opacity hover:opacity-85"
        >
          <img
            src="/logo.png"
            alt={siteConfig.name}
            width={288}
            height={192}
            className="h-auto w-10"
          />
          <span className="font-doto text-lg font-black tracking-tighter">
            Evil Buttons
          </span>
        </Link>

        <div className="flex items-center gap-3">
          <Select value={selected} onValueChange={setSelected}>
            <SelectTrigger className="w-52">
              <SelectValue placeholder="Pick a button" />
            </SelectTrigger>
            <SelectContent>
              {showcase.map((item) => (
                <SelectItem key={item.registryName} value={item.registryName}>
                  {item.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Link
            href={active.href}
            className="hidden items-center gap-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground sm:inline-flex"
          >
            Docs
            <ArrowUpRight className="size-3.5" />
          </Link>
        </div>
      </header>

      <main className="relative flex flex-1 items-center justify-center p-8">
        <div className="absolute inset-0 flex items-center justify-center">
          <FitToContainer className="h-full max-h-[min(70vh,560px)] w-full max-w-3xl">
            {active.render()}
          </FitToContainer>
        </div>
      </main>

      <footer className="flex shrink-0 items-center justify-between border-t border-border px-6 py-3">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
          {showcase.length} components
        </p>
        <div className="flex items-center gap-4">
          <Link
            href="/docs"
            className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Browse Docs
          </Link>
          <a
            href={siteConfig.github}
            target="_blank"
            rel="noreferrer"
            className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            GitHub
          </a>
        </div>
      </footer>
    </div>
  );
}