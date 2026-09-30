"use client";

import { Bar } from "@/components/charts/bar";
import { BarChart } from "@/components/charts/bar-chart";
import { ChartTooltip } from "@/components/charts/tooltip";
import type { RankedCount } from "@/lib/landing-stats";

/** Every series is one entity, so every mark wears the one brand accent. */
const SERIES = "var(--brand)";

const count = new Intl.NumberFormat("en");
const compactCount = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });

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
