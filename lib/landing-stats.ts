import { unstable_cache } from "next/cache";
import { showcase } from "@/components/landing/showcase";
import { siteConfig } from "@/lib/seo";
import { createTracwellMcp, TRACWELL_PROJECT_ID } from "@/lib/tracwell-mcp";

/** Seconds a fetched number is served before it's refreshed. */
const REVALIDATE = 10 * 60;

/** One UTC day of traffic. `date` is `YYYY-MM-DD` so it survives the cache. */
export type DailyTraffic = { date: string; visitors: number; views: number };

export type RankedCount = { name: string; count: number };

export type LandingStats = {
  stars: number | null;
  /** Page views over the last 30 days. */
  pageViews: number | null;
  /** `install_command_copied` events over the last 30 days. */
  installsCopied: number | null;
  /** Page views and visitors per day over the last 30 days, oldest first. */
  daily: DailyTraffic[];
  /** Referrers by page views over the last 30 days, largest first. */
  sources: RankedCount[];
  /** Components by install commands copied over the last 30 days. */
  mostCopied: RankedCount[];
};

type TracwellStats = Omit<LandingStats, "stars">;

const EMPTY_TRACWELL: TracwellStats = {
  pageViews: null,
  installsCopied: null,
  daily: [],
  sources: [],
  mostCopied: [],
};

async function fetchStars(): Promise<number | null> {
  const repo = new URL(siteConfig.github).pathname.slice(1);
  const token = process.env.GITHUB_TOKEN;
  const response = await fetch(`https://api.github.com/repos/${repo}`, {
    headers: {
      accept: "application/vnd.github+json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    next: { revalidate: REVALIDATE },
  });
  if (!response.ok) return null;
  const { stargazers_count } = (await response.json()) as { stargazers_count?: number };
  return stargazers_count ?? null;
}

/** The last 30 days, today included, as UTC `YYYY-MM-DD` dates. */
function last30Days() {
  const day = 24 * 60 * 60 * 1000;
  const iso = (time: number) => new Date(time).toISOString().slice(0, 10);
  return { from: iso(Date.now() - 29 * day), to: iso(Date.now()) };
}

type Breakdown = { value: string; count: number; share: number; views?: number };

type Overview = {
  metrics?: { views?: { value?: number } };
  trend?: { date: string; visitors: number; views: number }[];
  breakdowns?: { sources?: Breakdown[] };
};

type EventDetail = {
  breakdowns?: {
    pages?: Breakdown[];
    properties?: { key: string; values: { value: string; count: number }[] }[];
  };
};

/**
 * Event detail has no total, only breakdowns that may be truncated, so it's
 * recovered from the top row's count and its percentage share.
 */
function eventTotal({ breakdowns }: EventDetail) {
  const top = breakdowns?.pages?.[0];
  if (!top) return 0;
  return top.share > 0 ? Math.round((top.count * 100) / top.share) : top.count;
}

const componentNames = new Map(showcase.map((entry) => [entry.registryName, entry.name]));

/** Copies per component, keyed by the `registry_name` the copy button sends. */
function copiesByComponent({ breakdowns }: EventDetail): RankedCount[] {
  const values = breakdowns?.properties?.find((p) => p.key === "registry_name")?.values ?? [];
  return values.map(({ value, count }) => ({
    name: componentNames.get(value) ?? value,
    count,
  }));
}

/** Reads the 30-day numbers and breakdowns over Tracwell's MCP server. */
const fetchTracwell = unstable_cache(
  async (): Promise<TracwellStats> => {
    const key = process.env.TRACWELL_MCP_KEY;
    if (!key) return EMPTY_TRACWELL;
    const mcp = await createTracwellMcp(key);
    const range = { projectId: TRACWELL_PROJECT_ID, ...last30Days() };
    const [overview, installs] = await Promise.all([
      mcp.callTool("analytics_overview", range),
      mcp.callTool("analytics_event_detail", {
        ...range,
        eventName: "install_command_copied",
      }),
    ]);
    const traffic = overview.structuredContent as Overview;
    const copies = installs.structuredContent as EventDetail;
    return {
      pageViews: traffic?.metrics?.views?.value ?? null,
      installsCopied: eventTotal(copies),
      daily: (traffic?.trend ?? []).map(({ date, visitors, views }) => ({
        date,
        visitors,
        views,
      })),
      // "Others" lumps the long tail together, so it isn't a source to rank.
      // Tracwell orders sources by visitors, so re-rank them by page views.
      sources: (traffic?.breakdowns?.sources ?? [])
        .filter((source) => source.value !== "Others")
        .map(({ value, views = 0 }) => ({ name: value, count: views }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 6),
      mostCopied: copiesByComponent(copies).slice(0, 6),
    };
  },
  // Bump when the shape changes, so a cached entry of the old shape is never served.
  ["landing-tracwell-stats-v2"],
  { revalidate: REVALIDATE },
);

/** Every stat is independent: one failing source never hides the others. */
export async function getLandingStats(): Promise<LandingStats> {
  const [stars, tracwell] = await Promise.all([
    fetchStars().catch(() => null),
    fetchTracwell().catch((error: unknown) => {
      console.warn("Tracwell stats unavailable:", error);
      return EMPTY_TRACWELL;
    }),
  ]);
  return { stars, ...tracwell };
}
