"use client";

import { ArrowRight, GithubLogo, Moon, Sun } from "@phosphor-icons/react";
import Image from "next/image";
import Link from "next/link";
import { ShowcaseCarousel } from "@/components/landing/showcase-carousel";
import { useAppTheme } from "@/hooks/use-app-theme";
import { siteConfig } from "@/lib/seo";
import { toggleTheme } from "@/lib/theme-preference";

type LandingPageProps = {
  /** Docs category per showcase href, read from the MDX frontmatter. */
  categories: Record<string, string | undefined>;
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
          <span className="font-doto text-base font-black tracking-tighter">
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

export function LandingPage({ categories }: LandingPageProps) {
  return (
    <div className="flex h-dvh flex-col overflow-hidden landing-bg text-foreground">
      <Navbar />

      <section className="mx-auto flex max-w-3xl shrink-0 flex-col items-center px-4 pt-[clamp(1.5rem,5dvh,4rem)] text-center">
        <h1 className="text-4xl leading-[1.05] font-semibold tracking-[-0.03em] text-balance sm:text-6xl">
          Animated buttons, built with an{" "}
          <span className="font-doto font-black tracking-tighter text-brand [text-shadow:0_0_24px_color-mix(in_oklch,var(--brand)_45%,transparent)]">
            evil
          </span>{" "}
          touch.
        </h1>
        <p className="mt-5 max-w-xl text-base text-balance text-muted-foreground sm:text-lg">
          Hold, slide, doubt, glitch and detonate. Every button below is live —
          play with it, pick a variant, and install it with one command.
        </p>

        <div className="mt-8 grid w-full max-w-md grid-cols-2 gap-3">
          <Link
            href="/docs"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-primary px-5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Browse docs
            <ArrowRight className="size-4" weight="bold" />
          </Link>
          <a
            href={siteConfig.github}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-border bg-background px-5 text-sm font-medium text-foreground shadow-xs transition-colors hover:bg-muted"
          >
            <GithubLogo className="size-4" weight="bold" />
            GitHub
          </a>
        </div>
      </section>

      <section className="flex min-h-0 flex-1 items-center pt-[clamp(1rem,5dvh,3.5rem)]">
        <ShowcaseCarousel categories={categories} />
      </section>
    </div>
  );
}
