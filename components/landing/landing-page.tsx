"use client";

import {
  ArrowRight,
  GithubLogo,
  Moon,
  Sun,
} from "@phosphor-icons/react";
import Image from "next/image";
import Link from "next/link";
import { type ReactNode, useState } from "react";
import { EvilShader } from "@/components/landing/evil-shader";
import { ShowcaseCarousel } from "@/components/landing/showcase-carousel";
import {
  SHADCN_LABS_URL,
  ShadcnLabsLogomark,
} from "@/components/shadcn-labs";
import { useAppTheme } from "@/hooks/use-app-theme";
import { siteConfig } from "@/lib/seo";
import { toggleTheme } from "@/lib/theme-preference";

type LandingPageProps = {
  /** Docs category per showcase href, read from the MDX frontmatter. */
  categories: Record<string, string | undefined>;
  /** Sections below the first screen, rendered on the server. */
  children?: ReactNode;
};

const navIcon =
  "inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

function Navbar() {
  const isDark = useAppTheme() === "dark";

  return (
    <header className="shrink-0">
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link
          href="/"
          className="flex items-center gap-2 transition-opacity hover:opacity-80"
        >
          <Image
            src="/logo.png"
            alt=""
            width={288}
            height={192}
            className="h-auto w-7"
          />
          <span className="font-pixel-display text-base">
            Evil Buttons
          </span>
        </Link>
        <div className="flex items-center gap-1">
          <Link
            href="/docs"
            className="inline-flex h-8 items-center rounded-md px-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground"
          >
            Docs
          </Link>
          <a
            href={siteConfig.github}
            target="_blank"
            rel="noreferrer"
            aria-label="GitHub"
            className={navIcon}
          >
            <GithubLogo className="size-4" />
          </a>
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
            className={navIcon}
          >
            {isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </button>
        </div>
      </nav>
    </header>
  );
}

/** "Backed by" chip above the headline, in the same mono label voice as the showcase cards. */
function BackedBy() {
  return (
    <a
      href={SHADCN_LABS_URL}
      target="_blank"
      rel="noopener"
      aria-label="Backed by Shadcn Labs"
      className="group mb-6 inline-flex h-7 items-center gap-2.5 rounded-full border border-foreground/10 bg-background/30 px-3.5 shadow-[inset_0_1px_0_rgb(255_255_255/0.06)] backdrop-blur-md transition-colors hover:border-foreground/20 hover:bg-background/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring short:mb-3"
    >
      <span className="font-mono text-[10px] font-medium tracking-[0.16em] text-muted-foreground uppercase transition-colors group-hover:text-foreground">
        Backed by
      </span>
      <span aria-hidden className="h-3 w-px bg-foreground/15" />
      <ShadcnLabsLogomark className="h-3 w-auto text-foreground transition-colors duration-200 group-hover:text-[#f06292]" />
    </a>
  );
}

function ShaderBackdrop() {
  const theme = useAppTheme();
  const [failed, setFailed] = useState(false);

  if (failed) return null;

  // Falls back to the CSS .landing-bg underneath when WebGL2 is unavailable.
  return (
    <EvilShader
      theme={theme}
      onError={(error) => {
        console.warn("Landing shader disabled:", error.message);
        setFailed(true);
      }}
      className="pointer-events-none absolute inset-0 rounded-[inherit]"
    />
  );
}

// Eased stops so the fade has no visible band where it ends.
const scrimStops = [
  [0, 0.92],
  [0.2, 0.8],
  [0.4, 0.58],
  [0.6, 0.32],
  [0.8, 0.1],
  [1, 0],
] as const;

/** Darkens the top of the shader so the navbar and headline stay legible. */
function TopScrim() {
  return (
    <svg
      aria-hidden="true"
      preserveAspectRatio="none"
      className="pointer-events-none absolute inset-x-0 top-0 h-[60%] w-full"
    >
      <defs>
        <linearGradient id="landing-top-scrim" x1="0" y1="0" x2="0" y2="1">
          {scrimStops.map(([offset, opacity]) => (
            <stop
              key={offset}
              offset={offset}
              stopColor="var(--background)"
              stopOpacity={opacity}
            />
          ))}
        </linearGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#landing-top-scrim)" />
    </svg>
  );
}

export function LandingPage({ categories, children }: LandingPageProps) {
  return (
    // <body> never scrolls, so the page is its own scroll container.
    <div className="h-full overflow-y-auto bg-background text-foreground">
      {/* First screen: an inset, rounded frame that also clips the carousel. */}
      <div className="relative isolate m-1 flex h-[calc(100dvh-0.5rem)] flex-col overflow-hidden rounded-2xl border border-border sm:m-1.5 sm:h-[calc(100dvh-0.75rem)] sm:rounded-3xl">
        <div className="absolute inset-0 -z-10 overflow-hidden rounded-[inherit] landing-bg">
          <ShaderBackdrop />
          <TopScrim />
        </div>
        <Navbar />

        <section className="mx-auto flex max-w-3xl shrink-0 flex-col items-center px-4 pt-[clamp(0.75rem,5dvh,4rem)] text-center">
          <BackedBy />
          <h1 className="text-4xl leading-[1.05] font-semibold tracking-[-0.03em] text-balance sm:text-6xl short:text-3xl short:sm:text-5xl">
            Animated buttons, built with an{" "}
            {/* Easter egg: "evil" is a quiet link into the /drop trap. It reads as
                plain text; the only tell is the glow heating up on hover. */}
            <Link
              href="/drop"
              className="cursor-default rounded-sm font-pixel-display font-normal text-brand transition-[text-shadow] duration-500 [text-shadow:0_0_24px_color-mix(in_oklch,var(--brand)_45%,transparent)] hover:[text-shadow:0_0_32px_color-mix(in_oklch,var(--brand)_80%,transparent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              evil
            </Link>{" "}
            touch.
          </h1>
          <p className="mt-5 max-w-xl text-base text-balance text-muted-foreground sm:text-lg short:mt-3 short:text-sm short:sm:text-base">
            Hold, slide, doubt, glitch and detonate. Every button below is live
            — play with it, pick a variant, and install it with one command.
          </p>

          <div className="mt-8 grid w-full max-w-md grid-cols-2 gap-3 short:mt-5">
            <Link
              href="/docs"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-lg short:h-10 bg-primary px-3 text-sm whitespace-nowrap sm:px-5 font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Browse docs
              <ArrowRight className="size-4" weight="bold" />
            </Link>
            <a
              href={siteConfig.github}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-lg short:h-10 border border-border bg-background px-3 text-sm whitespace-nowrap sm:px-5 font-medium text-foreground shadow-xs transition-colors hover:bg-muted"
            >
              <GithubLogo className="size-4" weight="bold" />
              GitHub
            </a>
          </div>
        </section>

        <section className="flex min-h-0 flex-1 pt-[clamp(1rem,5dvh,3.5rem)] pb-[clamp(0.75rem,3dvh,2rem)]">
          <ShowcaseCarousel categories={categories} />
        </section>
      </div>
      {children}
    </div>
  );
}
