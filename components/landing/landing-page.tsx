"use client";

import { ArrowRight, GithubLogo } from "@phosphor-icons/react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DoubtButton } from "@/components/evil-buttons/doubt-button";
import { showcase } from "@/components/landing/showcase";
import { ShowcaseCarousel } from "@/components/landing/showcase-carousel";
import { ThemeToggle } from "@/components/theme-toggle";
import { siteConfig } from "@/lib/seo";

type LandingPageProps = {
  /** Docs category per showcase href, read from the MDX frontmatter. */
  categories: Record<string, string | undefined>;
};

function Navbar() {
  return (
    <div className="sticky top-3 z-40 px-4">
      <nav className="mx-auto flex h-12 max-w-2xl items-center justify-between gap-3 rounded-xl border border-border bg-background/80 pr-2 pl-3 shadow-sm backdrop-blur-md">
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
            className="inline-flex h-8 items-center rounded-md px-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            Docs
          </Link>
          <a
            href={siteConfig.github}
            target="_blank"
            rel="noreferrer"
            aria-label="GitHub"
            className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <GithubLogo className="size-4" weight="bold" />
          </a>
          <ThemeToggle />
        </div>
      </nav>
    </div>
  );
}

export function LandingPage({ categories }: LandingPageProps) {
  const router = useRouter();

  return (
    <div className="docs-scroll h-dvh overflow-y-auto bg-background text-foreground">
      <Navbar />

      <section className="mx-auto flex max-w-3xl flex-col items-center px-4 pt-20 text-center sm:pt-28">
        <p className="font-mono text-[11px] tracking-[0.2em] text-muted-foreground uppercase">
          {showcase.length} components · shadcn/ui registry
        </p>
        <h1 className="mt-5 text-4xl leading-[1.05] font-semibold tracking-[-0.03em] text-balance sm:text-6xl">
          Animated buttons, built with an{" "}
          <span className="font-doto font-black tracking-tighter">evil</span>{" "}
          touch.
        </h1>
        <p className="mt-5 max-w-xl text-base text-balance text-muted-foreground sm:text-lg">
          Hold, slide, doubt, glitch and detonate. Every button below is live —
          play with it, pick a variant, and install it with one command.
        </p>

        <div className="mt-9 grid w-full max-w-md grid-cols-2 gap-3">
          <Link
            href="/docs"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-primary px-5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Browse docs
            <ArrowRight className="size-4" weight="bold" />
          </Link>
          <DoubtButton
            label="Don't click"
            confirmations={["Are you sure?", "Seriously, don't.", "Last warning."]}
            successLabel="Too late."
            resetAfter={0}
            onConfirm={() => router.push("/drop")}
            className="h-11 w-full min-w-0"
          />
        </div>
      </section>

      <section className="overflow-x-clip pt-16 pb-24 sm:pt-20">
        <ShowcaseCarousel categories={categories} />
      </section>

    </div>
  );
}
