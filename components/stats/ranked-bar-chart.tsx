"use client";

import { motion, useReducedMotion } from "motion/react";
import type { RankedCount } from "@/lib/stats";

const count = new Intl.NumberFormat("en");
const compactCount = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });

/** Room the value takes after each bar, so the longest bar still fits its label. */
const VALUE_ROOM = "3.5rem";

/**
 * Horizontal bars, each with its value right where it ends. The longest bar
 * spans the track, so there's no dead gap between bars and numbers. Hovering a
 * row swaps the rounded value for the exact one.
 */
export function RankedBarChart({ rows, label }: { rows: RankedCount[]; label: string }) {
  const reduceMotion = useReducedMotion();
  const max = Math.max(...rows.map((row) => row.count), 1);

  return (
    <ol aria-label={label} className="flex flex-col gap-1">
      {rows.map((row, index) => (
        <li
          key={row.name}
          className="group grid h-8 grid-cols-[minmax(0,7.5rem)_minmax(0,1fr)] items-center gap-3 rounded-md px-1 text-xs transition-colors hover:bg-muted/60"
        >
          <span className="truncate text-right text-muted-foreground transition-colors group-hover:text-foreground">
            {row.name}
          </span>
          <span className="flex min-w-0 items-center gap-2">
            <motion.span
              aria-hidden
              className="block h-4 min-w-0.5 origin-left rounded-r-[4px] bg-brand"
              style={{ width: `calc((100% - ${VALUE_ROOM}) * ${row.count / max})` }}
              initial={reduceMotion ? false : { scaleX: 0 }}
              whileInView={{ scaleX: 1 }}
              viewport={{ once: true }}
              transition={{ type: "spring", stiffness: 260, damping: 30, delay: index * 0.04 }}
            />
            <span className="tabular-nums text-foreground">
              <span className="group-hover:hidden">{compactCount.format(row.count)}</span>
              <span className="hidden group-hover:inline">{count.format(row.count)}</span>
            </span>
          </span>
        </li>
      ))}
    </ol>
  );
}
