# Theming

## Use chartCssVars

Prefer the typed `chartCssVars` export over raw CSS variable strings.

### Incorrect

```tsx
<line stroke="var(--chart-crosshair)" />
<rect fill="var(--chart-indicator-color)" />
```

### Correct

```tsx
import { chartCssVars } from "@bklitui/ui/charts";

<line stroke={chartCssVars.crosshair} />
<rect fill={chartCssVars.indicatorColor} />
```

## Series colors

- Multi-series: `var(--chart-1)` through `var(--chart-5)` or theme tokens.
- Line charts: `var(--chart-line-primary)` / `var(--chart-line-secondary)` for default strokes.
- Do not hardcode hex colors unless the design explicitly requires brand colors outside the theme.

## Tooltip and badge surfaces

Tooltip boxes and live value badges should use shadcn popover tokens so text stays readable in light and dark mode:

```tsx
// Tooltip content / badges
className="bg-popover text-popover-foreground"
```

## Dark mode

Override chart variables in `:root` and `.dark` — do not sprinkle `dark:` on individual chart SVG elements.

```css
:root {
  --chart-background: oklch(1 0 0);
  --chart-grid: oklch(0.9 0 0);
}
.dark {
  --chart-background: oklch(0.145 0.004 285);
  --chart-grid: oklch(0.25 0 0);
}
```

## Docs

- Full theming guide: https://ui.bklit.com/docs/theming
