---
name: bklit-ui
description: >
  Bklit UI charts and data visualization for any project using the @bklit
  shadcn registry. Install, compose, theme, and animate charts correctly.
  Triggers when working with @bklitui/ui/charts, @bklit components, data
  visualization, dashboards, or chart theming. Also invoke manually for
  chart tasks.
allowed-tools: Bash(npx shadcn@latest *), Bash(pnpm dlx shadcn@latest *), Bash(bunx --bun shadcn@latest *)
---

# Bklit UI

Composable chart components for React, distributed via the `@bklit` shadcn registry. Charts are installed as source into the user's project.

> **IMPORTANT:** Run shadcn CLI commands with the project's package runner: `npx shadcn@latest`, `pnpm dlx shadcn@latest`, or `bunx --bun shadcn@latest`.

## Current Project Context

```json
!`npx shadcn@latest info --json`
```

Use the JSON above for framework, aliases, Tailwind version, installed components, and resolved paths. Confirm the `@bklit` registry is configured before adding charts.

## Principles

1. **Install before inventing.** Use `npx shadcn@latest add @bklit/<chart>` — charts are registry components, not hand-rolled SVG.
2. **Compose, don't flatten.** Root chart → `Grid` → series → axes → `ChartTooltip`. See [composition.md](./rules/composition.md).
3. **Theme with tokens.** Use `chartCssVars` and `--chart-*` variables — never hardcode one-off colors. See [theming.md](./rules/theming.md).
4. **Read the doc page first.** Each chart has props, data shape, and examples at `https://ui.bklit.com/docs/components/<slug>`.
5. **Browse variants.** Gallery: `https://ui.bklit.com/charts/<slug>` — Studio: `https://ui.bklit.com/studio?chart=<slug>`.

## Critical Rules

These rules are **always enforced**. Each links to Incorrect/Correct examples.

### Composition → [composition.md](./rules/composition.md)

- **Series and axes live inside the root chart** — `LineChart`, `BarChart`, `AreaChart`, etc.
- **One root per chart** — use `ComposedChart` for mixed series types.
- **Grid before series** so lines/bars render above grid lines.
- **`ChartTooltip` as a chart child** — required for crosshair and hover context.

### Theming → [theming.md](./rules/theming.md)

- **Use `chartCssVars`** from `@bklitui/ui/charts` instead of raw `"var(--chart-…)"` strings.
- **Series palette:** `--chart-1` … `--chart-5` for multi-series charts.
- **Tooltip surfaces:** `bg-popover text-popover-foreground` — avoids white-on-white in light mode.

### Animation → [animation.md](./rules/animation.md)

- **Default duration ~1100ms** for cartesian enter animations unless the doc specifies otherwise.
- **Replay:** change `revealSignature` or remount with a new `key`.
- **Live charts:** use `paused` on `LiveLineChart` to debug without stopping the rAF loop manually.

### Tooltips → [tooltips.md](./rules/tooltips.md)

- **Custom content via `ChartTooltip` `content` prop** or children patterns from docs.
- **`indicatorColor` function** for candlestick / dynamic crosshair colors.
- **Custom indicators:** use `useChart()` — do not track mouse globally outside chart context.

### Installation → [installation.md](./rules/installation.md)

- **Require `@bklit` registry** in `components.json`.
- **Install:** `npx shadcn@latest add @bklit/<slug>`.
- **Let the CLI install peer dependencies** — do not pin `@visx/*` / `motion` manually unless resolving a conflict.

## Chart Catalog

| Slug | Use when | Install | Docs | Gallery |
|------|----------|---------|------|---------|
| `area-chart` | Trends with filled regions under lines | `@bklit/area-chart` | [/docs/components/area-chart](https://ui.bklit.com/docs/components/area-chart) | [/charts/area-chart](https://ui.bklit.com/charts/area-chart) |
| `bar-chart` | Category comparisons, stacked or grouped bars | `@bklit/bar-chart` | [/docs/components/bar-chart](https://ui.bklit.com/docs/components/bar-chart) | [/charts/bar-chart](https://ui.bklit.com/charts/bar-chart) |
| `line-chart` | Time series, multi-line trends, markers | `@bklit/line-chart` | [/docs/components/line-chart](https://ui.bklit.com/docs/components/line-chart) | [/charts/line-chart](https://ui.bklit.com/charts/line-chart) |
| `live-line-chart` | Streaming / real-time data | `@bklit/live-line-chart` | [/docs/components/live-line-chart](https://ui.bklit.com/docs/components/live-line-chart) | [/charts/live-line-chart](https://ui.bklit.com/charts/live-line-chart) |
| `composed-chart` | Mixed bar + line (or similar) on one axis | `@bklit/composed-chart` | [/docs/components/composed-chart](https://ui.bklit.com/docs/components/composed-chart) | [/charts/composed-chart](https://ui.bklit.com/charts/composed-chart) |
| `scatter-chart` | Correlation, distribution, bubble sizing | `@bklit/scatter-chart` | [/docs/components/scatter-chart](https://ui.bklit.com/docs/components/scatter-chart) | [/charts/scatter-chart](https://ui.bklit.com/charts/scatter-chart) |
| `candlestick-chart` | OHLC financial data, brushes | `@bklit/candlestick-chart` | [/docs/components/candlestick-chart](https://ui.bklit.com/docs/components/candlestick-chart) | [/charts/candlestick-chart](https://ui.bklit.com/charts/candlestick-chart) |
| `pie-chart` | Part-to-whole slices | `@bklit/pie-chart` | [/docs/components/pie-chart](https://ui.bklit.com/docs/components/pie-chart) | [/charts/pie-chart](https://ui.bklit.com/charts/pie-chart) |
| `ring-chart` | Donut / ring KPIs | `@bklit/ring-chart` | [/docs/components/ring-chart](https://ui.bklit.com/docs/components/ring-chart) | [/charts/ring-chart](https://ui.bklit.com/charts/ring-chart) |
| `radar-chart` | Multi-axis comparison | `@bklit/radar-chart` | [/docs/components/radar-chart](https://ui.bklit.com/docs/components/radar-chart) | [/charts/radar-chart](https://ui.bklit.com/charts/radar-chart) |
| `gauge-chart` | Single-value KPI dial | `@bklit/gauge-chart` | [/docs/components/gauge-chart](https://ui.bklit.com/docs/components/gauge-chart) | [/charts/gauge-chart](https://ui.bklit.com/charts/gauge-chart) |
| `funnel-chart` | Stage conversion funnels | `@bklit/funnel-chart` | [/docs/components/funnel-chart](https://ui.bklit.com/docs/components/funnel-chart) | [/charts/funnel-chart](https://ui.bklit.com/charts/funnel-chart) |
| `sankey-chart` | Flow between nodes | `@bklit/sankey-chart` | [/docs/components/sankey-chart](https://ui.bklit.com/docs/components/sankey-chart) | [/charts/sankey-chart](https://ui.bklit.com/charts/sankey-chart) |
| `choropleth-chart` | Geo regions colored by value | `@bklit/choropleth-chart` | [/docs/components/choropleth-chart](https://ui.bklit.com/docs/components/choropleth-chart) | [/charts/choropleth-chart](https://ui.bklit.com/charts/choropleth-chart) |

## Workflow

1. Run `npx shadcn@latest info --json` — verify `@bklit` registry and aliases.
2. Pick a chart from the catalog (or ask the user what story the data tells).
3. Open the doc URL for data shape and props.
4. If not installed: `npx shadcn@latest add @bklit/<slug>`.
5. Compose with grid, series, axes, tooltip — apply theming tokens.
6. Point the user to the gallery or Studio URL for variant inspiration.

## Quick Reference

```bash
# Project info
npx shadcn@latest info --json

# Add a chart
npx shadcn@latest add @bklit/line-chart

# Search registries (if configured)
npx shadcn@latest search @bklit
```

```tsx
import { LineChart, Line, Grid, XAxis, ChartTooltip, chartCssVars } from "@bklitui/ui/charts";

<LineChart data={data} xDataKey="date">
  <Grid horizontal />
  <Line dataKey="users" stroke={chartCssVars.linePrimary} />
  <XAxis />
  <ChartTooltip />
</LineChart>
```

## Utility docs

- Theming: https://ui.bklit.com/docs/theming
- Grid: https://ui.bklit.com/docs/utility/grid
- Legend: https://ui.bklit.com/docs/utility/legend
- Tooltip: https://ui.bklit.com/docs/utility/tooltip
- Custom indicator: https://ui.bklit.com/docs/utility/custom-indicator
- useChart: https://ui.bklit.com/docs/utility/use-chart

## Detailed References

- [composition.md](./rules/composition.md)
- [theming.md](./rules/theming.md)
- [animation.md](./rules/animation.md)
- [tooltips.md](./rules/tooltips.md)
- [installation.md](./rules/installation.md)
