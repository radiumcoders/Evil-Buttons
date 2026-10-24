import { unstable_cache } from "next/cache";
import { showcase } from "@/components/landing/showcase";
import { siteConfig } from "@/lib/seo";
import { createTracwellMcp, TRACWELL_PROJECT_ID } from "@/lib/tracwell-mcp";

/** Seconds a fetched number is served before it's refreshed. */
const REVALIDATE = 10 * 60;

export type RankedCount = { name: string; count: number };

export type SiteStats = {
  stars: number | null;
  /** Page views over the last 30 days. */
  pageViews: number | null;
  /** `install_command_copied` events over the last 30 days. */
  installsCopied: number | null;
  /** Referrers by page views over the last 30 days, largest first. */
  sources: RankedCount[];
  /** Components by install commands copied over the last 30 days. */
  mostCopied: RankedCount[];
};

type TracwellStats = Omit<SiteStats, "stars">;

const EMPTY_TRACWELL: TracwellStats = {
  pageViews: null,
  installsCopied: null,
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

/** Registry names are sent bare from the carousel and namespaced from the docs. */
function registryName(name: string) {
  return name.replace(/^@evilbuttons\//, "");
}

/**
 * Copies per component, largest first. The carousel sends one `registry_name`;
 * the docs CLI block sends a `registry_items` array, so both are tallied.
 */
function copiesByComponent({ breakdowns }: EventDetail): RankedCount[] {
  const property = (key: string) =>
    breakdowns?.properties?.find((p) => p.key === key)?.values ?? [];
  const counts = new Map<string, number>();
  const add = (name: string, count: number) => {
    const key = registryName(name);
    counts.set(key, (counts.get(key) ?? 0) + count);
  };
  for (const { value, count } of property("registry_name")) add(value, count);
  for (const { value, count } of property("registry_items")) {
    try {
      for (const item of JSON.parse(value) as string[]) add(item, count);
    } catch {
      add(value, count);
    }
  }
  return [...counts]
    .map(([name, count]) => ({ name: componentNames.get(name) ?? name, count }))
    .sort((a, b) => b.count - a.count);
}

/** Referrers that are the same place under another name. */
const REFERRER_ALIASES: Record<string, string> = {
  "t.co": "x.com",
  "twitter.com": "x.com",
  "twitter.android": "x.com",
  "twitter.androie": "x.com",
  "android.googlequicksearchbox": "google.com",
};

/** Local dev visits and Tracwell's long-tail bucket aren't sources to rank. */
const IGNORED_REFERRERS = new Set(["Others", "localhost", "127.0.0.1"]);

/**
 * Page views per referrer, largest first. Some sites show up both as a bare
 * name (a utm_source) and as their domain, so "designeer" folds into
 * "designeer.xyz".
 */
function viewsByReferrer(sources: Breakdown[]): RankedCount[] {
  const names = sources.map((source) => source.value);
  const canonical = (name: string) => {
    if (REFERRER_ALIASES[name]) return REFERRER_ALIASES[name];
    if (name.includes(".")) return name;
    return names.find((other) => other.startsWith(`${name}.`)) ?? name;
  };
  const views = new Map<string, number>();
  for (const { value, views: count = 0 } of sources) {
    if (IGNORED_REFERRERS.has(value)) continue;
    const name = canonical(value);
    views.set(name, (views.get(name) ?? 0) + count);
  }
  return [...views]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
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
      // Tracwell orders sources by visitors, so they're re-ranked by page views.
      sources: viewsByReferrer(traffic?.breakdowns?.sources ?? []).slice(0, 6),
      mostCopied: copiesByComponent(copies).slice(0, 6),
    };
  },
  // Bump when the shape changes, so a cached entry of the old shape is never served.
  ["tracwell-stats-v3"],
  { revalidate: REVALIDATE },
);

/** Every stat is independent: one failing source never hides the others. */
export async function getStats(): Promise<SiteStats> {
  const [stars, tracwell] = await Promise.all([
    fetchStars().catch(() => null),
    fetchTracwell().catch((error: unknown) => {
      console.warn("Tracwell stats unavailable:", error);
      return EMPTY_TRACWELL;
    }),
  ]);
  return { stars, ...tracwell };
}
