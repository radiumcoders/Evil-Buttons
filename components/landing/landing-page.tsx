"use client";

import { FitToContainer } from "@/components/landing/fit-to-container";
import { ButtonPreview } from "@/components/landing/previews";
import { showcase } from "@/components/landing/showcase";
import { ThemeSync } from "@/components/theme-sync";
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

      <header className="flex shrink-0 items-center justify-between gap-4 px-6 py-4">
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
            <SelectTrigger className="w-52 rounded-none">
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
            <ButtonPreview key={`${selected}-${theme}`} registryName={selected} />
          </FitToContainer>
        </div>
      </main>

      <footer className="flex shrink-0 items-center justify-between px-6 py-3">
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