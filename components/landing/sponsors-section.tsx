import { XLogoIcon } from "@phosphor-icons/react/dist/ssr";
import { SHADCN_LABS_URL, ShadcnLabsLogotype } from "@/components/shadcn-labs";
import { cn } from "@/lib/utils";

/** Open slots point here until there's a proper sponsor page. */
const CONTACT_URL = "https://x.com/radiumcoders";

const cardBase =
  "group flex items-center justify-center rounded-2xl border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

type Slot = "open" | "shadcn-labs";

type Tier = {
  name: string;
  /** Rarity color for the label's dot, game-loot style. */
  dot: string;
  /** Card size: higher tiers get wider, taller cards. */
  size: string;
  slots: Slot[];
};

function TierLabel({ name, dot }: Pick<Tier, "name" | "dot">) {
  return (
    <h3 className="mt-12 mb-4 flex items-center justify-center gap-2 font-mono text-[11px] tracking-[0.18em] text-muted-foreground uppercase">
      <span aria-hidden className={cn("size-1.5 rounded-full", dot)} />
      {name}
    </h3>
  );
}

function OpenSlot({ className }: { className?: string }) {
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
      DM me if you&apos;re interested
    </a>
  );
}

function ShadcnLabsSlot({ className }: { className?: string }) {
  return (
    <a
      href={SHADCN_LABS_URL}
      target="_blank"
      // noopener only: noreferrer would hide the visit from their analytics.
      rel="noopener"
      aria-label="Shadcn Labs"
      className={cn(
        cardBase,
        "border-border bg-foreground/[0.025] hover:border-foreground/15 hover:bg-foreground/[0.05]",
        className,
      )}
    >
      <ShadcnLabsLogotype className="h-3.5 w-auto text-foreground transition-colors duration-200 group-hover:text-[#f06292]" />
    </a>
  );
}

// Widths leave room for the 0.75rem gaps: one, two and three cards a row
// (two on phones, so the lower tiers don't stack into a long column).
const tiers: Tier[] = [
  {
    name: "Mythic sponsors",
    dot: "bg-brand",
    size: "h-36 w-full sm:h-44",
    slots: ["open"],
  },
  {
    name: "Legendary sponsors",
    dot: "bg-amber-500",
    size: "h-28 w-[calc(50%-0.375rem)] sm:h-32",
    slots: ["open", "open"],
  },
  {
    name: "Sponsors",
    dot: "bg-muted-foreground/60",
    size: "h-20 w-[calc(50%-0.375rem)] sm:h-24 sm:w-[calc((100%-1.5rem)/3)]",
    slots: ["shadcn-labs", "open"],
  },
];

export function SponsorsSection() {
  return (
    <section className="bg-background px-4 pb-24 sm:px-6 sm:pb-32">
      <div className="mx-auto max-w-5xl">
        <h2 className="mx-auto max-w-md text-center text-3xl font-semibold tracking-[-0.03em] text-balance sm:text-4xl">
          Evil Buttons is backed and supported by the finest
        </h2>

        {tiers.map((tier) => (
          <div key={tier.name}>
            <TierLabel name={tier.name} dot={tier.dot} />
            {/* Centered rows, so a tier that isn't full still sits balanced. */}
            <div className="flex flex-wrap justify-center gap-3">
              {tier.slots.map((slot, index) =>
                slot === "shadcn-labs" ? (
                  <ShadcnLabsSlot key={slot} className={tier.size} />
                ) : (
                  <OpenSlot key={`${slot}-${index}`} className={tier.size} />
                ),
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
