# Chart Composition

## Root + children

Charts use a composable API. Always wrap series, axes, and overlays inside the root chart component.

### Incorrect

```tsx
<div className="h-80">
  <Line dataKey="users" />
  <XAxis />
</div>
```

### Correct

```tsx
<LineChart data={data}>
  <Grid horizontal />
  <Line dataKey="users" />
  <XAxis />
  <ChartTooltip />
</LineChart>
```

## Axes and grid

- Put `Grid` before series so lines render on top.
- Use `XAxis` / `YAxis` as siblings inside the root chart — not outside the chart context.
- For live streaming charts, use `LiveXAxis` and `LiveYAxis` inside `LiveLineChart`.

## Tooltips and markers

- `ChartTooltip` must be a child of the root chart so it can read hover state.
- Custom tooltip content receives chart context — prefer `useChart()` when building custom indicators.
- `ChartMarkers` and marker content render inside `ChartTooltip` when showing event callouts.

## Multi-series charts

- One `Line` / `Bar` / `Area` child per `dataKey`.
- Use `--chart-1` … `--chart-5` or explicit stroke/fill props for series differentiation.
- For combined line + bar, use `ComposedChart` instead of nesting unrelated roots.

## Data shape

- Cartesian charts: array of objects; set `xDataKey` on the root (default `"date"`).
- OHLC: use `CandlestickChart` with `{ date, open, high, low, close }`.
- Live line: `{ time, value }` points with a separate `value` prop on the root.
- Sankey / funnel / pie: follow each chart’s doc for node/link or slice shape.

## Docs

- Composition patterns: https://ui.bklit.com/docs/components/line-chart
- `useChart` hook: https://ui.bklit.com/docs/utility/use-chart
- Grid: https://ui.bklit.com/docs/utility/grid
- Legend: https://ui.bklit.com/docs/utility/legend
