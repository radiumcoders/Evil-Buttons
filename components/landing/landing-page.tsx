"use client";

import { FitToContainer } from "@/components/landing/fit-to-container";
import { ButtonPreview } from "@/components/landing/previews";
import { showcase } from "@/components/landing/showcase";
import { ThemeSync } from "@/components/theme-sync";
import { ThemeToggle } from "@/components/theme-toggle";
import { useAppTheme } from "@/hooks/use-app-theme";
import { siteConfig } from "@/lib/seo";
import { ArrowUpRight } from "@phosphor-icons/react";
import Link from "next/link";
import { useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function LandingPage() {
  const theme = useAppTheme();
  const [selected, setSelected] = useState(showcase[0].registryName);
  const active =
    showcase.find((item) => item.registryName === selected) ?? showcase[0];

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-background text-foreground">
      <ThemeSync />

      <header className="grid shrink-0 gap-3 px-4 py-3 sm:flex sm:items-center sm:justify-between sm:gap-4 sm:px-6 sm:py-4">
        <Link
          href="/"
          className="inline-flex w-fit items-center gap-2 transition-opacity hover:opacity-85"
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

        <div className="flex w-full min-w-0 items-center gap-2 sm:w-auto sm:gap-3">
          <ThemeToggle />
          <Select value={selected} onValueChange={setSelected}>
            <SelectTrigger className="h-8 w-full min-w-0 rounded-none sm:w-52">
              <SelectValue placeholder="Pick a button" />
            </SelectTrigger>
            <SelectContent className="rounded-none">
              {showcase.map((item) => (
                <SelectItem
                  key={item.registryName}
                  value={item.registryName}
                  className="rounded-none"
                >
                  {item.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Link
            href={active.href}
            className="hidden h-8 shrink-0 items-center gap-1 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground sm:inline-flex"
          >
            Docs
            <ArrowUpRight className="size-3.5" />
          </Link>
        </div>
      </header>

      <main className="flex min-h-0 flex-1 items-center justify-center px-4 py-4 sm:px-8 sm:py-8">
        <FitToContainer className="h-full max-h-[min(52dvh,380px)] w-full max-w-3xl sm:max-h-[min(70vh,560px)]">
          <ButtonPreview key={`${selected}-${theme}`} registryName={selected} />
        </FitToContainer>
      </main>

      <footer className="flex shrink-0 items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <p className="shrink-0 font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground sm:text-[11px] sm:tracking-[0.2em]">
          {showcase.length} components
        </p>
        <div className="flex min-w-0 items-center gap-3 sm:gap-4">
          <Link
            href="/docs"
            className="truncate text-xs font-medium text-muted-foreground transition-colors hover:text-foreground sm:text-sm"
          >
            Browse Docs
          </Link>
          <a
            href={siteConfig.github}
            target="_blank"
            rel="noreferrer"
            className="shrink-0 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground sm:text-sm"
          >
            GitHub
          </a>
        </div>
      </footer>
    </div>
  );
}