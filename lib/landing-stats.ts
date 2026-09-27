import { unstable_cache } from "next/cache";
import { siteConfig } from "@/lib/seo";
import { createTracwellMcp } from "@/lib/tracwell-mcp";

/** Seconds a fetched number is served before it's refreshed. */
const REVALIDATE = 60 * 60;

export type LandingStats = {
  stars: number | null;
  /** Unique visitors over the last 30 days. */
  visitors: number | null;
  /** `install_command_copied` events over the last 30 days. */
  installsCopied: number | null;
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

/** Tracwell's id for this site (not a secret; the MCP key is). */
const TRACWELL_PROJECT_ID = "888fa603-1018-468a-8e07-6275b95d2226";

/** The last 30 days, today included, as UTC `YYYY-MM-DD` dates. */
function last30Days() {
  const day = 24 * 60 * 60 * 1000;
  const iso = (time: number) => new Date(time).toISOString().slice(0, 10);
  return { from: iso(Date.now() - 29 * day), to: iso(Date.now()) };
}

type Overview = { metrics?: { visitors?: { value?: number } } };
type EventDetail = {
  breakdowns?: { pages?: { count: number; share: number }[] };
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

/** Reads visitors and install copies over Tracwell's MCP server. */
const fetchTracwell = unstable_cache(
  async (): Promise<Pick<LandingStats, "visitors" | "installsCopied">> => {
    const key = process.env.TRACWELL_MCP_KEY;
    if (!key) return { visitors: null, installsCopied: null };
    const mcp = await createTracwellMcp(key);
    const range = { projectId: TRACWELL_PROJECT_ID, ...last30Days() };
    const [overview, installs] = await Promise.all([
      mcp.callTool("analytics_overview", range),
      mcp.callTool("analytics_event_detail", {
        ...range,
        eventName: "install_command_copied",
      }),
    ]);
    return {
      visitors: (overview.structuredContent as Overview)?.metrics?.visitors?.value ?? null,
      installsCopied: eventTotal(installs.structuredContent as EventDetail),
    };
  },
  ["landing-tracwell-stats"],
  { revalidate: REVALIDATE },
);

/** Every stat is independent: one failing source never hides the others. */
export async function getLandingStats(): Promise<LandingStats> {
  const [stars, tracwell] = await Promise.all([
    fetchStars().catch(() => null),
    fetchTracwell().catch((error: unknown) => {
      console.warn("Tracwell stats unavailable:", error);
      return { visitors: null, installsCopied: null };
    }),
  ]);
  return { stars, ...tracwell };
}
