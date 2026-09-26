"use client";

import { ArrowRight, ArrowUpRight, GithubLogo } from "@phosphor-icons/react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { packageCommands, PackageManagerTabs } from "@/components/cli-block";
import CopyButton from "@/components/copy-button";
import { DoubtButton } from "@/components/evil-buttons/doubt-button";
import { FitToContainer } from "@/components/landing/fit-to-container";
import { ShowcasePreview } from "@/components/landing/showcase-preview";
import { showcase, type ShowcaseEntry } from "@/components/landing/showcase";
import { ThemeToggle } from "@/components/theme-toggle";
import { type PackageManager, useConfig } from "@/hooks/use-config";
import { siteConfig } from "@/lib/seo";
import { cn } from "@/lib/utils";

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
    <article className="rounded-xl bg-muted/50 p-1 dark:bg-muted/25">
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
        <div className="relative h-72 p-6">
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
            <ShowcasePreview registryName={item.registryName} variant={variant} />
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
                source: "landing_grid",
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

export function LandingPage({ categories }: LandingPageProps) {
  const router = useRouter();
  const { packageManager, setConfig } = useConfig();

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

      <section className="mx-auto max-w-6xl px-4 pt-24 pb-16 sm:pt-32">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">
              Try every button
            </h2>
            <p className="text-sm text-muted-foreground">
              Click, hold, drag. Copy the install command when one earns its
              place.
            </p>
          </div>
          <PackageManagerTabs
            value={packageManager}
            onChange={(manager) => setConfig({ packageManager: manager })}
          />
        </div>

        {/* On lg the side columns sit lower than the middle one. */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:pb-16 lg:[&>*:nth-child(3n)]:translate-y-16 lg:[&>*:nth-child(3n+1)]:translate-y-16">
          {showcase.map((item) => (
            <ShowcaseCard
              key={item.registryName}
              item={item}
              category={categories[item.href]}
              packageManager={packageManager}
            />
          ))}
        </div>
      </section>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-6 font-mono text-[11px] text-muted-foreground">
          <p>
            © {new Date().getFullYear()} {siteConfig.author.name}
          </p>
          <a
            href={siteConfig.github}
            target="_blank"
            rel="noreferrer"
            className="transition-colors hover:text-foreground"
          >
            GitHub
          </a>
        </div>
      </footer>
    </div>
  );
}
