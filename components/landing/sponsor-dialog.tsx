"use client";

import { ArrowUpRightIcon, CheckIcon, MinusIcon, XLogoIcon } from "@phosphor-icons/react";
import { type CSSProperties, type ReactNode, useState } from "react";
import { SponsorShader } from "@/components/landing/sponsor-shader";
import {
  perks,
  type SponsorTier,
  sponsorTiers,
  type TierId,
} from "@/components/landing/sponsor-tiers";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useAppTheme } from "@/hooks/use-app-theme";
import { cn } from "@/lib/utils";

const CONTACT_URL = "https://x.com/radiumcoders";

/** The dialog's --popover, so the shader melts into it. */
const POPOVER = { dark: "#171717", light: "#ffffff" };

const compact = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });

const cadenceShort = { month: "/mo", once: " once" } as const;
const cadenceLong = { month: "per month", once: "one-time" } as const;

/** Tier-colored light from above, if the shader can't run. */
function TierGlow({ tier, active }: { tier: SponsorTier; active: boolean }) {
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-x-0 top-0 h-64 transition-opacity duration-500",
        active ? "opacity-100" : "opacity-0",
      )}
      style={{
        background: `radial-gradient(90% 100% at 50% 0%, color-mix(in oklch, ${tier.accent} 26%, transparent), transparent 70%)`,
      }}
    />
  );
}

/**
 * Sponsorship details, opened from an open slot on the landing. Starts on
 * the slot's tier; the switcher shows what the other tiers add or drop.
 */
export function SponsorDialog({
  tier: initialTier,
  visitors,
  children,
}: {
  tier: TierId;
  /** Visitors over the last 30 days, when known. */
  visitors: number | null;
  children: ReactNode;
}) {
  const theme = useAppTheme();
  const [tierId, setTierId] = useState(initialTier);
  const [shaderFailed, setShaderFailed] = useState(false);
  const tier = sponsorTiers.find((t) => t.id === tierId) ?? sponsorTiers[0];

  return (
    <Dialog onOpenChange={(open) => open && setTierId(initialTier)}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent
        // Scrolls rather than overflowing on short phones; the footer stays put.
        className="flex max-h-[calc(100dvh-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-md"
        style={
          { "--tier": tier.accent, "--cta": tier.cta, "--cta-ink": tier.ctaInk } as CSSProperties
        }
      >
        {/* Dithered glow in the tier's colors, fading out before the perks. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-64 mask-[linear-gradient(to_bottom,black_35%,transparent)]"
        >
          {shaderFailed ? (
            sponsorTiers.map((option) => (
              <TierGlow key={option.id} tier={option} active={option.id === tierId} />
            ))
          ) : (
            <SponsorShader
              theme={theme}
              palette={tier.palette}
              background={POPOVER}
              onError={(error) => {
                console.warn("Sponsor shader disabled:", error.message);
                setShaderFailed(true);
              }}
              className="opacity-75"
            />
          )}
          {/* Keeps the left-aligned heading legible; the glow stays vivid on the right. */}
          <div className="absolute inset-0 bg-[linear-gradient(100deg,var(--popover)_15%,color-mix(in_oklch,var(--popover)_65%,transparent)_55%,transparent_90%)]" />
        </div>

        <div className="relative flex flex-col gap-5 overflow-y-auto p-5">
          <div>
            <p className="font-mono text-[10px] tracking-[0.18em] text-muted-foreground uppercase">
              Sponsorship
            </p>
            <DialogTitle className="mt-2 text-xl font-semibold tracking-[-0.02em]">
              Sponsor{" "}
              <span className="font-pixel-display font-normal text-brand">Evil</span>{" "}
              Buttons
            </DialogTitle>
            <DialogDescription className="mt-1.5">
              Put your logo in front of developers picking components for their next build
              {visitors ? `, ${compact.format(visitors)} of them in the last 30 days` : ""}.
            </DialogDescription>
          </div>

          <div
            role="group"
            aria-label="Tier"
            className="grid grid-cols-3 gap-1 rounded-xl border border-border bg-background/60 p-1 backdrop-blur-sm"
          >
            {sponsorTiers.map((option) => {
              const selected = option.id === tierId;
              return (
                <button
                  key={option.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setTierId(option.id)}
                  className={cn(
                    "flex flex-col items-center gap-0.5 rounded-lg border border-transparent py-2 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    selected &&
                      "border-(--tier)/40 bg-[color-mix(in_oklch,var(--tier)_12%,var(--background))] text-foreground",
                  )}
                >
                  <span className="flex items-center gap-1.5">
                    <span
                      aria-hidden
                      className="size-1.5 rounded-full"
                      style={{ background: option.accent }}
                    />
                    {option.name}
                  </span>
                  <span className="font-mono text-[10px] tracking-wide text-muted-foreground">
                    ${option.price}
                    {cadenceShort[option.cadence]}
                  </span>
                </button>
              );
            })}
          </div>

          <div>
            <div className="flex items-end justify-between gap-3">
              <p className="flex items-baseline gap-2">
                <span className="font-pixel-display text-5xl leading-none tracking-tight">
                  ${tier.price}
                </span>
                <span className="text-sm text-muted-foreground">{cadenceLong[tier.cadence]}</span>
              </p>
              <span className="mb-1 inline-flex h-6 items-center rounded-full border border-(--tier)/40 bg-[color-mix(in_oklch,var(--tier)_10%,transparent)] px-2.5 font-mono text-[10px] tracking-[0.14em] text-foreground uppercase">
                {tier.spots}
              </span>
            </div>
            <p className="mt-3 text-sm font-medium">{tier.summary}</p>

            <ul className="mt-3 divide-y divide-border overflow-hidden rounded-xl border border-border bg-background/40">
              {perks.map((perk) => {
                const detail = tier.perks[perk.id];
                return (
                  <li key={perk.id} className="flex gap-3 px-3 py-2.5">
                    {detail ? (
                      <CheckIcon weight="bold" className="mt-0.5 size-3.5 shrink-0 text-(--tier)" />
                    ) : (
                      <MinusIcon className="mt-0.5 size-3.5 shrink-0 text-muted-foreground/40" />
                    )}
                    <span className={cn("min-w-0", !detail && "text-muted-foreground/50")}>
                      <span className="block text-sm">{perk.label}</span>
                      {detail ? (
                        <span className="block text-xs text-muted-foreground">{detail}</span>
                      ) : null}
                    </span>
                  </li>
                );
              })}
            </ul>

            {tier.id === "sponsor" ? (
              <p className="mt-3 text-xs text-muted-foreground">
                Shadcn Labs keeps its hero spot as our founding sponsor. They backed Evil
                Buttons before there were tiers.
              </p>
            ) : null}
          </div>
        </div>

        <div className="relative flex flex-col-reverse gap-3 border-t border-border bg-muted/50 p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            Perks are still taking shape. Ask for what you need.
          </p>
          <a
            href={CONTACT_URL}
            target="_blank"
            rel="noreferrer"
            className="group inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg bg-(--cta) px-4 text-sm font-semibold text-(--cta-ink) shadow-[inset_0_1px_0_rgb(255_255_255/0.3),inset_0_-1px_0_rgb(0_0_0/0.15),0_10px_28px_-10px_var(--cta)] transition-[filter,box-shadow,background-color] duration-300 hover:shadow-[inset_0_1px_0_rgb(255_255_255/0.3),inset_0_-1px_0_rgb(0_0_0/0.15),0_12px_36px_-8px_var(--cta)] hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-popover active:translate-y-px"
          >
            <XLogoIcon weight="bold" className="size-4" />
            DM me about {tier.name}
            <ArrowUpRightIcon
              weight="bold"
              className="size-3.5 opacity-70 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
            />
          </a>
        </div>
      </DialogContent>
    </Dialog>
  );
}
