"use client";

import { useEffect, useRef, useState } from "react";
import { Area, AreaChart } from "@/components/charts/area-chart";
import { Bar } from "@/components/charts/bar";
import { BarChart } from "@/components/charts/bar-chart";
import { Grid } from "@/components/charts/grid";
import { LiveLine } from "@/components/charts/live-line";
import { LiveLineChart } from "@/components/charts/live-line-chart";
import { LiveXAxis } from "@/components/charts/live-x-axis";
import { ChartTooltip } from "@/components/charts/tooltip";
import { XAxis } from "@/components/charts/x-axis";
import type { DailyTraffic, RankedCount } from "@/lib/landing-stats";
import type { LiveVisitors } from "@/lib/live-visitors";

/** Every series is one entity, so every mark wears the one brand accent. */
const SERIES = "var(--brand)";
const MUTED = "var(--muted-foreground)";

const count = new Intl.NumberFormat("en");
const compactCount = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });

/** Solid hairlines: a dashed grid reads as a threshold. */
function HairlineGrid() {
  return <Grid horizontal numTicksRows={4} strokeDasharray="none" />;
}

export function DailyVisitorsChart({ daily }: { daily: DailyTraffic[] }) {
  // Local midnight, so the axis names the same day in every timezone.
  const data = daily.map(({ date, visitors, views }) => {
    const [year, month, day] = date.split("-").map(Number);
    return { date: new Date(year, month - 1, day), visitors, views };
  });

  return (
    <AreaChart
      data={data}
      aspectRatio="auto"
      className="h-56 sm:h-64"
      margin={{ top: 16, right: 12, bottom: 28, left: 12 }}
    >
      <HairlineGrid />
      {/* Today is still counting, so its segment is dashed. */}
      <Area dataKey="visitors" fill={SERIES} dashFromIndex={data.length - 2} />
      <XAxis numTicks={5} />
      <ChartTooltip
        rows={(point) => [
          { color: SERIES, label: "Visitors", value: count.format(point.visitors as number) },
          { color: MUTED, label: "Page views", value: count.format(point.views as number) },
        ]}
      />
    </AreaChart>
  );
}

const ROW = 36;
const BAR_GAP = 0.45;
const LABEL_WIDTH = 124;
const VALUE_WIDTH = 52;
const BAR_MARGIN = { top: 4, right: VALUE_WIDTH, bottom: 4, left: LABEL_WIDTH };

/**
 * Horizontal bars with names and counts drawn as HTML beside them. BarYAxis
 * caps labels at 70px, too narrow for component names, so rows are placed
 * at the band centers the chart's scaleBand computes.
 */
export function RankedBarChart({ rows, label }: { rows: RankedCount[]; label: string }) {
  const step = (rows.length * ROW) / (rows.length + BAR_GAP);
  const center = (index: number) => BAR_MARGIN.top + step * (index + (1 + BAR_GAP) / 2);

  return (
    <div
      className="relative"
      style={{ height: rows.length * ROW + BAR_MARGIN.top + BAR_MARGIN.bottom }}
    >
      <BarChart
        data={rows}
        xDataKey="name"
        orientation="horizontal"
        aspectRatio="auto"
        className="h-full"
        barGap={BAR_GAP}
        margin={BAR_MARGIN}
      >
        <Bar dataKey="count" fill={SERIES} lineCap={4} />
        <ChartTooltip
          showCrosshair={false}
          showDots={false}
          rows={(point) => [
            { color: SERIES, label, value: count.format(point.count as number) },
          ]}
        />
      </BarChart>
      {rows.map((row, index) => (
        <div
          key={row.name}
          aria-hidden
          className="pointer-events-none absolute inset-x-0 flex -translate-y-1/2 items-center text-xs"
          style={{ top: center(index) }}
        >
          <span
            className="truncate pr-3 text-right text-muted-foreground"
            style={{ width: LABEL_WIDTH }}
          >
            {row.name}
          </span>
          <span
            className="ml-auto pl-2 tabular-nums text-foreground"
            style={{ width: VALUE_WIDTH }}
          >
            {compactCount.format(row.count)}
          </span>
        </div>
      ))}
    </div>
  );
}

const POLL_MS = 20 * 1000;
const clock = new Intl.DateTimeFormat("en", { hour: "numeric", minute: "2-digit" });
// Module-level so the live chart's per-frame memos stay stable.
const formatClock = (ms: number) => clock.format(ms);
const formatOnline = (value: number) => `${Math.round(value)}`;

/** True while the element is on screen and the tab is in front. */
function useWatched<T extends Element>() {
  const ref = useRef<T>(null);
  const [onScreen, setOnScreen] = useState(false);
  const [tabVisible, setTabVisible] = useState(true);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new IntersectionObserver(([entry]) => setOnScreen(entry.isIntersecting));
    observer.observe(element);
    const onVisibility = () => setTabVisible(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return [ref, onScreen && tabVisible] as const;
}

/**
 * Visitors online right now, polled from /api/live-visitors while on screen.
 * The route caches for 15s, so every viewer shares the same few reads.
 */
export function LiveVisitorsCard() {
  const [ref, watched] = useWatched<HTMLDivElement>();
  const [live, setLive] = useState<LiveVisitors | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "unavailable">("loading");

  useEffect(() => {
    if (!watched) return;
    let timer: number | undefined;
    let cancelled = false;

    async function poll() {
      try {
        const response = await fetch("/api/live-visitors", { cache: "no-store" });
        const { live: next } = (await response.json()) as { live: LiveVisitors | null };
        if (cancelled) return;
        if (next) {
          setLive(next);
          setStatus("ready");
        } else {
          setStatus((current) => (current === "ready" ? current : "unavailable"));
        }
      } catch {
        // A missed poll keeps the last reading; the next one tries again.
      }
      if (!cancelled) timer = window.setTimeout(poll, POLL_MS);
    }

    poll();
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [watched]);

  return (
    <div ref={ref} className="flex h-full flex-col">
      <div className="flex items-center gap-2 text-xs text-muted-foreground sm:text-sm">
        <span className="relative flex size-2">
          {status === "ready" ? (
            <span className="absolute inset-0 animate-ping rounded-full bg-brand opacity-60 motion-reduce:animate-none" />
          ) : null}
          <span
            className={
              status === "ready"
                ? "relative size-2 rounded-full bg-brand"
                : "relative size-2 rounded-full bg-muted-foreground/40"
            }
          />
        </span>
        Live, last 30 minutes
      </div>

      <div className="mt-3 flex items-baseline gap-2">
        <span className="font-pixel-display text-4xl tracking-tight sm:text-5xl">
          {live ? count.format(live.online) : "–"}
        </span>
        <span className="text-sm text-muted-foreground">
          {live?.online === 1 ? "visitor" : "visitors"} online
        </span>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        {status === "unavailable"
          ? "Live numbers are taking a break."
          : live
            ? `${count.format(live.views)} page views in the last 30 minutes`
            : "Counting who's here…"}
      </p>

      <div className="mt-4 min-h-40 flex-1">
        {live && live.points.length > 1 ? (
          <LiveLineChart
            data={live.points}
            value={live.online}
            window={30 * 60}
            numXTicks={3}
            paused={!watched}
            margin={{ top: 16, right: 44, bottom: 28, left: 8 }}
            style={{ height: "100%", minHeight: 160 }}
          >
            <LiveLine dataKey="value" stroke={SERIES} formatValue={formatOnline} />
            <LiveXAxis numTicks={3} formatTime={formatClock} />
            <ChartTooltip
              showDatePill={false}
              rows={(point) => [
                { color: SERIES, label: "Online", value: formatOnline(point.value as number) },
              ]}
            />
          </LiveLineChart>
        ) : null}
      </div>
    </div>
  );
}
