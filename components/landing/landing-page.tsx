"use client";

import { ArrowRight } from "@phosphor-icons/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { DoubtButton } from "@/components/evil-buttons/doubt-button";
import { ShowcaseCarousel } from "@/components/landing/showcase-carousel";

type LandingPageProps = {
  /** Docs category per showcase href, read from the MDX frontmatter. */
  categories: Record<string, string | undefined>;
};

export function LandingPage({ categories }: LandingPageProps) {
  const router = useRouter();

  return (
    <div className="flex h-dvh flex-col overflow-hidden landing-bg text-foreground">
      <section className="mx-auto flex max-w-3xl shrink-0 flex-col items-center px-4 pt-[clamp(2.5rem,8dvh,6rem)] text-center">
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

      <section className="flex min-h-0 flex-1 items-center">
        <ShowcaseCarousel categories={categories} />
      </section>
    </div>
  );
}
