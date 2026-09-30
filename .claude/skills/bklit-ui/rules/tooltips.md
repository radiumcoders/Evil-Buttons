# Tooltips

## Default tooltip

Use `ChartTooltip` as a child of the root chart. Defaults include crosshair, dots, and date pill where applicable.

```tsx
<LineChart data={data}>
  <Line dataKey="users" />
  <XAxis />
  <ChartTooltip />
</LineChart>
```

## Custom content

```tsx
<ChartTooltip
  content={({ point, formattedDate }) => (
    <div className="rounded-md bg-popover px-3 py-2 text-popover-foreground text-sm">
      <div className="font-medium">{formattedDate}</div>
      <div>{point.users as number} users</div>
    </div>
  )}
/>
```

## indicatorColor (candlestick and crosshair)

Match the crosshair to the hovered datum — e.g. green/red candles:

```tsx
<ChartTooltip
  indicatorColor={(point) =>
    (point.close as number) >= (point.open as number)
      ? "var(--chart-1)"
      : "var(--chart-3)"
  }
  showDots={false}
/>
```

## Custom indicators

For advanced crosshair/markers, use `useChart()` and the patterns in the custom indicator docs.

### Incorrect

```tsx
// Reading mouse position manually outside chart context
const [x, setX] = useState(0);
useEffect(() => {
  window.addEventListener("mousemove", ...);
}, []);
```

### Correct

```tsx
import { useChart } from "@bklitui/ui/charts";

function CustomIndicator() {
  const { tooltipData } = useChart();
  // render from tooltipData
}
```

## Docs

- ChartTooltip: https://ui.bklit.com/docs/utility/tooltip
- Custom indicators: https://ui.bklit.com/docs/utility/custom-indicator
