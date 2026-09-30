"use client";

import { ShaderBackdrop, TopScrim } from "@/components/landing/shader-backdrop";
import { siteConfig } from "@/lib/seo";

const LICENSE_URL = `${siteConfig.github}/blob/main/LICENSE`;

const legalLinks = [
  { label: "Sitemap", href: "/sitemap.xml" },
  { label: "robots.txt", href: "/robots.txt" },
  { label: "llms.txt", href: "/llms.txt" },
];

const smallText =
  "rounded-sm text-foreground/60 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

/** Two-tone chip in the spirit of a license seal. */
function LicenseBadge() {
  return (
    <a
      href={LICENSE_URL}
      target="_blank"
      rel="noreferrer"
      className="inline-flex h-5 items-stretch overflow-hidden rounded-sm border border-foreground/15 font-mono text-[9px] font-medium tracking-[0.14em] uppercase focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span className="flex items-center bg-foreground px-1.5 text-background">Open source</span>
      <span className="flex items-center bg-background/40 px-1.5 text-foreground backdrop-blur-sm">
        Apache 2.0
      </span>
    </a>
  );
}

export function LandingFooter() {
  const year = new Date().getFullYear();

  return (
    // The same inset frame as the first screen. The gap is padding, not
    // margin: a scroll container drops its last child's bottom margin.
    <div className="p-1 sm:p-1.5">
      <footer className="relative isolate flex min-h-[30rem] flex-col overflow-hidden rounded-2xl border border-border sm:min-h-[38rem] sm:rounded-3xl">
        <div className="absolute inset-0 -z-10 overflow-hidden rounded-[inherit] landing-bg">
          <ShaderBackdrop />
          <TopScrim />
        </div>

        <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 sm:px-6">
          <p
            aria-hidden
            className="mt-auto pt-16 text-[clamp(3.5rem,20vw,11.5rem)] leading-[0.86] font-semibold tracking-[-0.05em] text-foreground select-none"
          >
            <span className="block font-pixel-display font-normal tracking-[-0.02em]">Evil</span>
            <span className="block">Buttons.</span>
          </p>

          <div className="flex flex-col gap-3 pt-10 pb-6 text-xs sm:flex-row sm:items-center sm:justify-between">
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-foreground/60">
              <span>Evil Buttons © {year}</span>
              <span aria-hidden>·</span>
              <span>
                Built by{" "}
                <a href={siteConfig.author.url} target="_blank" rel="noreferrer" className={smallText}>
                  {siteConfig.author.name}
                </a>
              </span>
            </p>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-2">
              {legalLinks.map((link, index) => (
                <span key={link.label} className="flex items-center gap-2">
                  {index > 0 ? <span aria-hidden className="text-foreground/40">·</span> : null}
                  <a href={link.href} className={smallText}>
                    {link.label}
                  </a>
                </span>
              ))}
              <span className="ml-1">
                <LicenseBadge />
              </span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
