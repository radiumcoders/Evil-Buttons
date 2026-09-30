import { fetchLiveVisitors } from "@/lib/live-visitors";

// Cached and refreshed at most every 15s, however many people are watching,
// so Tracwell sees a steady trickle of reads instead of one per visitor.
export const dynamic = "force-static";
export const revalidate = 15;

export async function GET() {
  const key = process.env.TRACWELL_MCP_KEY;
  if (!key) return Response.json({ live: null });
  try {
    return Response.json({ live: await fetchLiveVisitors(key) });
  } catch (error) {
    console.warn("Live visitors unavailable:", error);
    return Response.json({ live: null });
  }
}
