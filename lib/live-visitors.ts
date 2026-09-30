import { createTracwellMcp, TRACWELL_PROJECT_ID } from "@/lib/tracwell-mcp";

const MINUTE = 60 * 1000;
/** How far back the live chart looks. */
const WINDOW = 30 * MINUTE;
/** A visitor counts as online for this long after their last event. */
const ONLINE_FOR = 5 * MINUTE;
/** Stream pages are capped at 100 events; this bounds a traffic spike. */
const PAGE_SIZE = 100;
const MAX_PAGES = 10;

export type LivePoint = { time: number; value: number };

export type LiveVisitors = {
  /** Unique visitors seen in the last five minutes. */
  online: number;
  /** Page views in the last 30 minutes. */
  views: number;
  /** Visitors online at each minute of the window, in Unix seconds. */
  points: LivePoint[];
};

type StreamEvent = { id: string; kind: string; actor: string; receivedTime: string };
type Stream = { events?: StreamEvent[]; completeness?: { eventsHasMore?: boolean } };
type Mcp = Awaited<ReturnType<typeof createTracwellMcp>>;

/** Tracwell's stream reads within one UTC day, so a window over midnight is split. */
function dayWindows(from: number, to: number) {
  const windows: { date: string; fromTime: string; toTime: string }[] = [];
  for (let start = from; start < to; ) {
    const midnight = new Date(start).setUTCHours(24, 0, 0, 0);
    const end = Math.min(midnight, to);
    windows.push({
      date: new Date(start).toISOString().slice(0, 10),
      fromTime: new Date(start).toISOString(),
      toTime: new Date(end).toISOString(),
    });
    start = end;
  }
  return windows;
}

/** Events newest first; pages backwards by moving `toTime` to the oldest seen. */
async function readStream(mcp: Mcp, window: ReturnType<typeof dayWindows>[number]) {
  const events: StreamEvent[] = [];
  let toTime = window.toTime;
  let complete = false;
  for (let page = 0; page < MAX_PAGES && !complete; page++) {
    const result = await mcp.callTool("analytics_events", {
      projectId: TRACWELL_PROJECT_ID,
      date: window.date,
      view: "stream",
      limit: PAGE_SIZE,
      excludeBots: true,
      fromTime: window.fromTime,
      toTime,
    });
    const { events: batch = [], completeness } = result.structuredContent as Stream;
    events.push(...batch);
    const oldest = batch.at(-1);
    complete = !completeness?.eventsHasMore || !oldest;
    if (oldest) toTime = oldest.receivedTime;
  }
  return { events, complete };
}

/** Reads the last half hour of events and turns them into visitors online. */
export async function fetchLiveVisitors(key: string): Promise<LiveVisitors> {
  const now = Date.now();
  // Points sit on whole minutes so they don't shift between refreshes.
  const lastMinute = Math.floor(now / MINUTE) * MINUTE;
  const from = lastMinute - WINDOW - ONLINE_FOR;

  const mcp = await createTracwellMcp(key);
  // Windows run newest first, so a capped read loses the oldest events only.
  const reads = [];
  for (const window of dayWindows(from, now).reverse()) {
    const read = await readStream(mcp, window);
    reads.push(read);
    if (!read.complete) break;
  }

  const seen = new Set<string>();
  const events = reads
    .flatMap((read) => read.events)
    .filter((event) => !seen.has(event.id) && seen.add(event.id))
    .map((event) => ({ ...event, time: Date.parse(event.receivedTime) }));

  // After a capped read, only minutes with a full lookback are reported.
  const truncated = reads.some((read) => !read.complete);
  const coveredFrom = truncated ? Math.min(...events.map((event) => event.time)) : from;

  const onlineAt = (time: number) =>
    new Set(
      events
        .filter((event) => event.time > time - ONLINE_FOR && event.time <= time)
        .map((event) => event.actor),
    ).size;

  const times: number[] = [];
  for (let time = lastMinute - WINDOW; time <= lastMinute; time += MINUTE) {
    if (time - ONLINE_FOR >= coveredFrom) times.push(time);
  }
  if (now > lastMinute) times.push(now);

  return {
    online: onlineAt(now),
    views: events.filter((event) => event.kind === "pageview" && event.time > now - WINDOW)
      .length,
    points: times.map((time) => ({ time: time / 1000, value: onlineAt(time) })),
  };
}
