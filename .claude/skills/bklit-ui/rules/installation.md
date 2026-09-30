# Installation

## Prerequisites

Bklit UI is a shadcn registry. Initialize shadcn in the project first:

```bash
npx shadcn@latest init
```

## Registry namespace

Add the `@bklit` namespace to `components.json` if it is not already present:

```json
{
  "registries": {
    "@bklit": "https://ui.bklit.com/r/{name}.json"
  }
}
```

New projects scaffolded with Bklit often include this automatically.

## Install a chart

```bash
npx shadcn@latest add @bklit/line-chart
```

Replace `line-chart` with any chart slug from the catalog. The CLI copies source into your components directory and installs peer dependencies.

## Verify project context

```bash
npx shadcn@latest info --json
```

Use the JSON to confirm framework, aliases, Tailwind version, and which `@bklit` components are already installed.

## Import path

After install, import from the charts entry (path may vary by alias — check `info --json`):

```tsx
import { LineChart, Line, Grid, XAxis, ChartTooltip } from "@/components/ui/line-chart";
// or from package re-exports when using the npm package directly:
import { LineChart, Line, Grid, XAxis, ChartTooltip } from "@bklitui/ui/charts";
```

Prefer the import path your project’s shadcn install actually generated.

## Common peer dependencies

| Chart | Typical dependencies |
|-------|---------------------|
| line-chart, area-chart | `@visx/curve`, `@visx/shape`, `motion` |
| bar-chart | `@visx/gradient`, `@visx/pattern`, `@visx/shape`, `motion` |
| candlestick-chart | `@visx/scale`, `@visx/shape`, `@visx/responsive`, `d3-array`, `motion` |
| live-line-chart | `@visx/curve`, `@visx/scale`, `@visx/shape`, `@visx/responsive`, `@visx/event`, `d3-array`, `motion` |
| choropleth-chart | `@visx/geo`, `@visx/responsive`, `@visx/zoom`, `d3-geo`, `topojson-client`, `motion` |
| sankey-chart | `@visx/gradient`, `@visx/pattern`, `@visx/responsive`, `@visx/sankey`, `motion` |
| scatter-chart | `d3-scale`, `d3-array`, `motion`, `react-use-measure` |
| pie-chart, ring-chart | `@visx/responsive`, `@visx/shape`, `motion` |
| radar-chart | `@visx/responsive`, `d3-shape`, `motion` |
| funnel-chart | `motion` |
| gauge-chart | `@visx/responsive`, `motion` |

The CLI installs these when adding a chart — do not guess versions; let `shadcn add` resolve them.

## Docs

- Installation: https://ui.bklit.com/docs/installation
- Per-chart install tabs: https://ui.bklit.com/docs/components/<slug>
