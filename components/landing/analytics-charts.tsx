"use client";

import { Area, AreaChart } from "@/components/charts/area-chart";
import { Bar } from "@/components/charts/bar";
import { BarChart } from "@/components/charts/bar-chart";
import { Grid } from "@/components/charts/grid";
import { ChartTooltip } from "@/components/charts/tooltip";
import { XAxis } from "@/components/charts/x-axis";
import type { DailyTraffic, RankedCount } from "@/lib/landing-stats";

/** Every series is one entity, so every mark wears the one brand accent. */
const SERIES = "var(--brand)";
const MUTED = "var(--muted-foreground)";

const count = new Intl.NumberFormat("en");
const compactCount = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });

/** Solid hairlines: a dashed grid reads as a threshold. */
function HairlineGrid() {
  return <Grid horizontal numTicksRows={4} strokeDasharray="none" />;
}

export function DailyViewsChart({ daily }: { daily: DailyTraffic[] }) {
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
      <Area dataKey="views" fill={SERIES} dashFromIndex={data.length - 2} />
      <XAxis numTicks={5} />
      <ChartTooltip
        rows={(point) => [
          { color: SERIES, label: "Page views", value: count.format(point.views as number) },
          { color: MUTED, label: "Visitors", value: count.format(point.visitors as number) },
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
