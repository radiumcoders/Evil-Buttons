import { ArrowRightIcon, PlusIcon } from "@phosphor-icons/react/dist/ssr";
import type { ReactNode } from "react";
import { SHADCN_LABS_URL, ShadcnLabsLogotype } from "@/components/shadcn-labs";
import { TracwellLogo, tracwellUrl } from "@/components/tracwell-card";
import { cn } from "@/lib/utils";

const SPONSOR_URL = "https://github.com/sponsors/radiumcoders";

const card =
  "group flex flex-col items-center justify-center gap-3 rounded-2xl border border-border bg-foreground/[0.025] transition-colors hover:border-foreground/15 hover:bg-foreground/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

function TierLabel({ children }: { children: ReactNode }) {
  return (
    <h3 className="mt-12 mb-4 text-center font-mono text-[11px] tracking-[0.18em] text-muted-foreground uppercase first-of-type:mt-10">
      {children}
    </h3>
  );
}

function SponsorCard({
  href,
  label,
  role,
  className,
  children,
}: {
  href: string;
  /** Accessible name, since the logo inside is decorative. */
  label: string;
  role?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      // noopener only: noreferrer would hide the visit from their analytics.
      rel="noopener"
      aria-label={role ? `${label}, ${role.toLowerCase()}` : label}
      className={cn(card, className)}
    >
      {children}
      {role ? (
        <span className="font-mono text-[10px] tracking-[0.16em] text-muted-foreground uppercase">
          {role}
        </span>
      ) : null}
    </a>
  );
}

export function SponsorsSection() {
  return (
    <section className="bg-background px-4 pb-24 sm:px-6 sm:pb-32">
      <div className="mx-auto max-w-5xl">
        <h2 className="mx-auto max-w-md text-center text-3xl font-semibold tracking-[-0.03em] text-balance sm:text-4xl">
          Evil Buttons is backed and supported by the finest
        </h2>

        <TierLabel>Sponsor</TierLabel>
        <SponsorCard href={SHADCN_LABS_URL} label="Shadcn Labs" className="h-36 sm:h-44">
          <ShadcnLabsLogotype className="h-6 w-auto text-foreground transition-colors duration-200 group-hover:text-[#f06292] sm:h-8" />
        </SponsorCard>

        <TierLabel>Platform sponsors</TierLabel>
        <div className="grid gap-3 sm:grid-cols-2">
          <SponsorCard
            href={tracwellUrl("sponsors")}
            label="Tracwell"
            role="Analytics sponsor"
            className="h-32"
          >
            <span className="flex items-center gap-2 text-foreground">
              <TracwellLogo className="size-8" />
              <span className="text-2xl font-semibold tracking-[-0.03em]">Tracwell</span>
            </span>
          </SponsorCard>
          <a
            href={SPONSOR_URL}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              card,
              "h-32 flex-row gap-2 border-dashed text-sm text-muted-foreground hover:text-foreground",
            )}
          >
            <PlusIcon className="size-4" />
            Your logo here
          </a>
        </div>

        <div className="mt-8 text-center">
          <a
            href={SPONSOR_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="group inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground underline decoration-foreground/25 underline-offset-4 transition-colors hover:text-foreground hover:decoration-foreground/60"
          >
            Become a sponsor
            <ArrowRightIcon className="size-3.5 transition-transform group-hover:translate-x-0.5" />
          </a>
        </div>
      </div>
    </section>
  );
}
