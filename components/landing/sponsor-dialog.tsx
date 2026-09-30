"use client";

import { CheckIcon, MinusIcon, XLogoIcon } from "@phosphor-icons/react";
import { type CSSProperties, type ReactNode, useState } from "react";
import {
  perks,
  type SponsorTier,
  sponsorTiers,
  type TierId,
} from "@/components/landing/sponsor-tiers";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const CONTACT_URL = "https://x.com/radiumcoders";

const compact = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });

const cadenceShort = { month: "/mo", once: " once" } as const;
const cadenceLong = { month: "per month", once: "one-time" } as const;

/** Tier-colored light from above, over the landing's pixel grid. */
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
  const [tierId, setTierId] = useState(initialTier);
  const tier = sponsorTiers.find((t) => t.id === tierId) ?? sponsorTiers[0];

  return (
    <Dialog onOpenChange={(open) => open && setTierId(initialTier)}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent
        // Scrolls rather than overflowing on short phones; the footer stays put.
        className="flex max-h-[calc(100dvh-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-md"
        style={{ "--tier": tier.accent } as CSSProperties}
      >
        {sponsorTiers.map((option) => (
          <TierGlow key={option.id} tier={option} active={option.id === tierId} />
        ))}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-[linear-gradient(to_right,var(--landing-grid)_1px,transparent_1px),linear-gradient(to_bottom,var(--landing-grid)_1px,transparent_1px)] bg-size-[4px_4px] [--landing-grid:color-mix(in_oklch,var(--foreground)_6%,transparent)] mask-[linear-gradient(to_bottom,black,transparent)]"
        />

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
          <Button asChild className="h-9 px-3.5">
            <a href={CONTACT_URL} target="_blank" rel="noreferrer">
              <XLogoIcon />
              DM me about {tier.name}
            </a>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
