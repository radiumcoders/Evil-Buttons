"use client";

import { CheckIcon, MinusIcon, XLogoIcon } from "@phosphor-icons/react";
import { type ReactNode, useState } from "react";
import { perks, sponsorTiers, type TierId } from "@/components/landing/sponsor-tiers";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const CONTACT_URL = "https://x.com/radiumcoders";

const compact = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });

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
      {/* Scrolls rather than overflowing on short phones. */}
      <DialogContent className="max-h-[calc(100dvh-2rem)] gap-5 overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Sponsor Evil Buttons</DialogTitle>
          <DialogDescription>
            Put your logo in front of developers picking components for their next build
            {visitors ? `, ${compact.format(visitors)} of them in the last 30 days` : ""}.
          </DialogDescription>
        </DialogHeader>

        <div
          role="group"
          aria-label="Tier"
          className="grid grid-cols-3 gap-1 rounded-lg bg-muted p-1"
        >
          {sponsorTiers.map((option) => (
            <button
              key={option.id}
              type="button"
              aria-pressed={option.id === tierId}
              onClick={() => setTierId(option.id)}
              className={cn(
                "flex h-8 items-center justify-center gap-1.5 rounded-md text-xs font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                option.id === tierId && "bg-background text-foreground shadow-xs",
              )}
            >
              <span aria-hidden className={cn("size-1.5 rounded-full", option.dot)} />
              {option.name}
            </button>
          ))}
        </div>

        <div>
          <div className="flex items-baseline justify-between gap-3">
            <p className="font-medium">{tier.summary}</p>
            <span className="shrink-0 font-mono text-[10px] tracking-[0.14em] text-muted-foreground uppercase">
              {tier.spots}
            </span>
          </div>

          <ul className="mt-3 divide-y divide-border rounded-lg border border-border">
            {perks.map((perk) => {
              const detail = tier.perks[perk.id];
              return (
                <li key={perk.id} className="flex gap-3 px-3 py-2.5">
                  {detail ? (
                    <CheckIcon weight="bold" className="mt-0.5 size-3.5 shrink-0 text-brand" />
                  ) : (
                    <MinusIcon className="mt-0.5 size-3.5 shrink-0 text-muted-foreground/50" />
                  )}
                  <span className={cn("min-w-0", !detail && "text-muted-foreground/60")}>
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

        <DialogFooter className="items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            Perks are still taking shape. Ask for what you need.
          </p>
          <Button asChild>
            <a href={CONTACT_URL} target="_blank" rel="noreferrer">
              <XLogoIcon />
              DM me on X
            </a>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
