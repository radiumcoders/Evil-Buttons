import { PlusIcon, XLogoIcon } from "@phosphor-icons/react/dist/ssr";
import { SponsorDialog } from "@/components/landing/sponsor-dialog";
import { sponsorTiers, type TierId } from "@/components/landing/sponsor-tiers";
import { SHADCN_LABS_URL, ShadcnLabsLogotype } from "@/components/shadcn-labs";
import { TracwellLogo, tracwellUrl } from "@/components/tracwell-card";
import { cn } from "@/lib/utils";

const cardBase =
  "group flex items-center justify-center rounded-2xl border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

type Slot = "open" | "shadcn-labs";

// Card size and slots per tier. Widths leave room for the 0.75rem gaps: one,
// two and three cards a row (two on phones, so the lower tiers don't stack
// into a long column).
const smallCard = "h-20 w-[calc(50%-0.375rem)] sm:h-24 sm:w-[calc((100%-1.5rem)/3)]";

const layout: Record<TierId, { size: string; slots: Slot[] }> = {
  mythic: { size: "h-36 w-full sm:h-44", slots: ["open"] },
  legendary: { size: "h-28 w-[calc(50%-0.375rem)] sm:h-32", slots: ["open", "open"] },
  sponsor: { size: smallCard, slots: ["shadcn-labs", "open"] },
};

/** Platform sponsors give a service rather than money, so they sit outside the paid tiers. */
const PLATFORM_ACCENT = "oklch(0.62 0.19 260)";
const CONTACT_URL = "https://x.com/radiumcoders";

function TierLabel({ label, accent }: { label: string; accent: string }) {
  return (
    <h3 className="mt-12 mb-4 flex items-center justify-center gap-2 font-mono text-[11px] tracking-[0.18em] text-muted-foreground uppercase">
      <span aria-hidden className="size-1.5 rounded-full" style={{ background: accent }} />
      {label}
    </h3>
  );
}

function OpenSlot({
  tier,
  pageViews,
  className,
}: {
  tier: TierId;
  pageViews: number | null;
  className: string;
}) {
  return (
    <SponsorDialog tier={tier} pageViews={pageViews}>
      <button
        type="button"
        className={cn(
          cardBase,
          "gap-2 border-dashed border-border bg-foreground/[0.015] px-4 text-center text-sm text-muted-foreground hover:border-foreground/25 hover:bg-foreground/[0.04] hover:text-foreground",
          className,
        )}
      >
        <PlusIcon className="size-3.5 shrink-0" />
        DM me if you&apos;re interested
      </button>
    </SponsorDialog>
  );
}

/** Base tier, but it keeps a hero spot for backing the project early. */
function ShadcnLabsSlot({ className }: { className: string }) {
  return (
    <a
      href={SHADCN_LABS_URL}
      target="_blank"
      // noopener only: noreferrer would hide the visit from their analytics.
      rel="noopener"
      aria-label="Shadcn Labs, founding sponsor"
      className={cn(
        cardBase,
        "flex-col gap-2 border-border bg-foreground/[0.025] hover:border-foreground/15 hover:bg-foreground/[0.05]",
        className,
      )}
    >
      <ShadcnLabsLogotype className="h-3.5 w-auto text-foreground transition-colors duration-200 group-hover:text-[#f06292]" />
      <span className="font-mono text-[9px] tracking-[0.16em] text-muted-foreground uppercase">
        Founding sponsor
      </span>
    </a>
  );
}

function TracwellSlot({ className }: { className: string }) {
  return (
    <a
      href={tracwellUrl("sponsors")}
      target="_blank"
      // noopener only: noreferrer would hide the visit from their analytics.
      rel="noopener"
      aria-label="Tracwell, analytics sponsor"
      className={cn(
        cardBase,
        "flex-col gap-2 border-border bg-foreground/[0.025] hover:border-foreground/15 hover:bg-foreground/[0.05]",
        className,
      )}
    >
      <span className="flex items-center gap-1.5 text-foreground">
        <TracwellLogo className="size-4" />
        <span className="text-[15px] leading-none font-semibold tracking-[-0.02em]">Tracwell</span>
      </span>
      <span className="font-mono text-[9px] tracking-[0.16em] text-muted-foreground uppercase">
        Analytics sponsor
      </span>
    </a>
  );
}

/** No price list for platforms yet, so this goes straight to a DM. */
function PlatformOpenSlot({ className }: { className: string }) {
  return (
    <a
      href={CONTACT_URL}
      target="_blank"
      rel="noreferrer"
      className={cn(
        cardBase,
        "gap-2 border-dashed border-border bg-foreground/[0.015] px-4 text-center text-sm text-muted-foreground hover:border-foreground/25 hover:bg-foreground/[0.04] hover:text-foreground",
        className,
      )}
    >
      <XLogoIcon className="size-3.5 shrink-0" />
      Offer your platform
    </a>
  );
}

export function SponsorsSection({ pageViews }: { pageViews: number | null }) {
  return (
    <section className="bg-background px-4 pb-24 sm:px-6 sm:pb-32">
      <div className="mx-auto max-w-5xl">
        <h2 className="mx-auto max-w-md text-center text-3xl font-semibold tracking-[-0.03em] text-balance sm:text-4xl">
          Evil Buttons is backed and supported by the finest
        </h2>

        {sponsorTiers.map((tier) => {
          const { size, slots } = layout[tier.id];
          return (
            <div key={tier.id}>
              <TierLabel label={tier.label} accent={tier.accent} />
              {/* Centered rows, so a tier that isn't full still sits balanced. */}
              <div className="flex flex-wrap justify-center gap-3">
                {slots.map((slot, index) =>
                  slot === "shadcn-labs" ? (
                    <ShadcnLabsSlot key={slot} className={size} />
                  ) : (
                    <OpenSlot
                      key={`${slot}-${index}`}
                      tier={tier.id}
                      pageViews={pageViews}
                      className={size}
                    />
                  ),
                )}
              </div>
            </div>
          );
        })}

        <TierLabel label="Platform sponsors" accent={PLATFORM_ACCENT} />
        <div className="flex flex-wrap justify-center gap-3">
          <TracwellSlot className={smallCard} />
          <PlatformOpenSlot className={smallCard} />
        </div>
      </div>
    </section>
  );
}
