import { ArrowUpRightIcon, GithubLogoIcon } from "@phosphor-icons/react/dist/ssr";
import { showcase } from "@/components/landing/showcase";
import { TracwellCard } from "@/components/tracwell-card";
import type { LandingStats } from "@/lib/landing-stats";
import { siteConfig } from "@/lib/seo";
import { cn } from "@/lib/utils";

const compact = new Intl.NumberFormat("en", {
  notation: "compact",
  maximumFractionDigits: 1,
});

type Stat = { label: string; value: number; href?: string };

const lgColumns: Record<number, string> = {
  1: "lg:grid-cols-1",
  2: "lg:grid-cols-2",
  3: "lg:grid-cols-3",
  4: "lg:grid-cols-4",
};

export function StatsSection({ stats }: { stats: LandingStats }) {
  // Numbers that couldn't be fetched are left out rather than shown as zero.
  const tiles: Stat[] = [];
  if (stats.stars !== null) {
    tiles.push({ label: "GitHub stars", value: stats.stars, href: siteConfig.github });
  }
  tiles.push({ label: "Components", value: showcase.length });
  if (stats.visitors !== null) {
    tiles.push({ label: "Visitors, last 30 days", value: stats.visitors });
  }
  if (stats.installsCopied !== null) {
    tiles.push({ label: "Installs copied, last 30 days", value: stats.installsCopied });
  }

  return (
    <section className="bg-background px-4 py-20 sm:px-6 sm:py-28">
      <div className="mx-auto max-w-5xl">
        <div className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-end">
          <div>
            <p className="font-mono text-[11px] tracking-[0.18em] text-muted-foreground uppercase">
              In the open
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-[-0.03em] text-balance sm:text-4xl">
              Built in public, measured in public.
            </h2>
          </div>
          <a
            href={siteConfig.github}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-10 shrink-0 items-center gap-2 rounded-lg border border-border bg-background px-4 text-sm font-medium shadow-xs transition-colors hover:bg-muted"
          >
            <GithubLogoIcon className="size-4" weight="bold" />
            Star on GitHub
          </a>
        </div>

        <dl
          className={cn(
            "mt-10 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border",
            // A lone last tile on phones spans the row instead of leaving a gap.
            "[&>*:last-child:nth-child(odd)]:col-span-2 lg:[&>*]:col-span-1!",
            lgColumns[tiles.length],
          )}
        >
          {tiles.map((tile) => (
            <div
              key={tile.label}
              className="group relative bg-background p-5 transition-colors has-[a:hover]:bg-muted sm:p-6"
            >
              <dt className="flex items-center gap-1 text-xs text-muted-foreground sm:text-sm">
                {tile.label}
                {tile.href ? (
                  <ArrowUpRightIcon className="size-3 transition-transform group-has-[a:hover]:translate-x-0.5 group-has-[a:hover]:-translate-y-0.5" />
                ) : null}
              </dt>
              <dd className="mt-3 font-doto text-4xl font-black tracking-tighter tabular-nums sm:text-5xl">
                {compact.format(tile.value)}
              </dd>
              {tile.href ? (
                <a
                  href={tile.href}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`${compact.format(tile.value)} ${tile.label}`}
                  className="absolute inset-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                />
              ) : null}
            </div>
          ))}
        </dl>

        <div className="mt-6 max-w-56">
          <TracwellCard />
        </div>
      </div>
    </section>
  );
}
