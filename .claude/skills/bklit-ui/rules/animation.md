# Animation

## Defaults

Most cartesian charts default to ~1100ms enter animation. Bar charts often use staggered reveals (~1.2s total) with easing `cubic-bezier(0.85, 0, 0.15, 1)`.

## Replay enter animations

Pass a changing `revealSignature` (or remount the chart with a new `key`) to replay mount animations after prop changes.

### Correct

```tsx
const [replayKey, setReplayKey] = useState(0);

<LineChart key={replayKey} data={data} revealSignature={String(replayKey)}>
  {/* ... */}
</LineChart>

<button type="button" onClick={() => setReplayKey((k) => k + 1)}>
  Replay
</button>
```

## Live charts

- `LiveLineChart` runs its own animation loop — use `paused` to freeze updates for debugging.
- Avoid nesting heavy state updates inside the rAF path; pass stable props where possible.

## Reduced motion

Respect `prefers-reduced-motion` when adding custom animation wrappers around charts. Bklit charts handle reduced motion internally for enter transitions.

## Performance

- Prefer CSS/SVG-friendly props over re-creating large data arrays every frame.
- For streaming data, append points and trim the window instead of replacing the full array when possible.

## Inspiration

Browse animated variants: https://ui.bklit.com/charts/<chart-slug>  
Tune motion interactively: https://ui.bklit.com/studio?chart=<chart-slug>
