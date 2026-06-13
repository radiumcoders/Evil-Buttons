# Plan 006: Defer-mount WebGL buttons on the landing grid

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat da89f42..HEAD -- components/landing/landing-page.tsx components/LiquidChrome.tsx components/EvilEye.tsx components/evil-buttons/chrome-button.tsx components/evil-buttons/evil-eye-button.tsx`
> If any changed since this plan was written, compare against the "Current state"
> excerpts before proceeding; on a mismatch, treat it as a STOP condition.

## Status

- **Priority**: P3
- **Effort**: M
- **Risk**: MED
- **Depends on**: none
- **Category**: perf
- **Planned at**: commit `da89f42`, 2026-06-13
- **Confidence**: MED — the cost is real (continuous WebGL render loops), but the
  user-visible win should be confirmed with the profiler step below before
  committing effort.

## Why this matters

The landing page (`/`) mounts **all 21** button components at once in a grid, and
two of them run continuous WebGL render loops via `ogl` that never idle:
`ChromeButton` (`LiquidChrome`) and `EvilEyeButton` (`EvilEye`). `LiquidChrome`
calls `requestAnimationFrame(update)` unconditionally for as long as it's
mounted — even when its grid cell is scrolled off-screen or the tab is
backgrounded with the page visible — and renders a multi-sample fragment shader
every frame. With both shader buttons live plus the other RAF-driven buttons,
the home page burns GPU/CPU continuously for content the user may never scroll
to. Deferring the WebGL components until their cell is near the viewport (and
unmounting when far away) cuts idle GPU usage and active WebGL contexts.

## Current state

- The landing renders every showcase item eagerly:

```277:283:components/landing/landing-page.tsx
      <main className="flex-1 overflow-y-auto">
        <div className="grid grid-cols-2 border-t border-border md:grid-cols-3 xl:border-l xl:border-t-0">
          {showcase.map((item) => (
            <ButtonCell key={item.name} item={item} />
          ))}
        </div>
      </main>
```

- Each cell renders `item.render()` inside `FitToContainer`:

```189:215:components/landing/landing-page.tsx
  return (
    <div className="group relative flex aspect-square flex-col overflow-hidden border-r border-b border-border bg-background transition-colors hover:bg-muted/30">
      <div className="absolute top-0 left-0 z-10 px-3 py-2 font-mono text-[11px] font-medium text-muted-foreground">
        {item.name}
      </div>
      <div className="flex flex-1 items-center justify-center p-4">
        <FitToContainer>{item.render()}</FitToContainer>
      </div>
```

- The two WebGL render functions in the showcase:

```100:105:components/landing/landing-page.tsx
  {
    name: "ChromeButton",
    href: "/docs/chrome-button",
    registryName: "chrome-button",
    render: () => <ChromeButton>Chromy</ChromeButton>,
  },
```

```82:87:components/landing/landing-page.tsx
  {
    name: "EvilEyeButton",
    href: "/docs/evil-eye-button",
    registryName: "evil-eye-button",
    render: () => <EvilEyeButton>Doom</EvilEyeButton>,
  },
```

- `LiquidChrome` runs an unconditional RAF loop and (importantly) cleans up
  fully on unmount — cancels the frame, removes listeners, and loses the GL
  context — which makes mount/unmount safe:

```163:174:components/LiquidChrome.tsx
    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener("resize", resize);
      if (interactive) {
        container.removeEventListener("mousemove", handleMouseMove);
        container.removeEventListener("touchmove", handleTouchMove);
      }
      if (gl.canvas.parentElement) {
        gl.canvas.parentElement.removeChild(gl.canvas);
      }
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    };
```

- `EvilEyeButton` already respects `prefers-reduced-motion` (renders a static
  CSS eye instead of the shader), so the deferral must not break that path:

```91:95:components/evil-buttons/evil-eye-button.tsx
  const reduceMotion = useSyncExternalStore(
    subscribeToReducedMotion,
    getReducedMotionSnapshot,
    getServerReducedMotionSnapshot,
  );
```

The landing component is a client component (`"use client"` at
`components/landing/landing-page.tsx:1`), so hooks/IntersectionObserver are fine.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Install | `pnpm install --frozen-lockfile` | exit 0 |
| Dev server | `pnpm dev` | serves http://localhost:3000 |
| Typecheck | `pnpm typecheck` | exit 0 (requires plan 002) |
| Lint | `pnpm lint` | exit 0 |
| Build | `pnpm build` | exit 0 |

## Suggested executor toolkit

- If the `vercel-react-best-practices` skill is available, consult it for the
  IntersectionObserver/lazy-mount pattern in client components.

### Step 0 (confirm the problem before building)

With `pnpm dev` running, open `/`, open DevTools → Performance, record ~5s while
the page is idle (not scrolling). Confirm there is steady scripting/GPU activity
attributable to the WebGL loops. If activity is already negligible (e.g. the
browser throttles offscreen WebGL effectively here), STOP and report — the
optimization may not be worth the added complexity.

## Scope

**In scope**:
- `components/landing/landing-page.tsx` (add a `DeferredMount` wrapper and use it
  around the two WebGL cells)
- optionally a new `components/landing/deferred-mount.tsx`

**Out of scope** (do NOT touch):
- `components/LiquidChrome.tsx`, `components/EvilEye.tsx` — their render loops
  and cleanup stay as-is. This plan controls *when they're mounted*, not how they
  run.
- `components/evil-buttons/chrome-button.tsx`,
  `components/evil-buttons/evil-eye-button.tsx` — the button components are
  unchanged; only their placement in the landing grid is wrapped.
- The registry output and the docs — components shipped to users must keep
  working standalone (no DeferredMount dependency leaks into the registry).
- The other 19 buttons — do not wrap them (their RAF loops are event-gated and
  cheap; wrapping all 21 risks layout jank for no measured gain).

## Git workflow

- Branch: `advisor/006-defer-mount-webgl-buttons`
- Commit message: `perf(landing): defer-mount WebGL buttons until in view`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Create a `DeferredMount` wrapper

Create `components/landing/deferred-mount.tsx`. It renders a `placeholder` until
its wrapper scrolls within a margin of the viewport, then renders `children`;
when it scrolls far away again it returns to the placeholder (unmounting the
WebGL child so its cleanup runs). Keep the outer box sized like the real content
so the grid doesn't reflow.

```tsx
"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";

export function DeferredMount({
  children,
  placeholder = null,
  rootMargin = "200px",
}: {
  children: ReactNode;
  placeholder?: ReactNode;
  rootMargin?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting),
      { rootMargin },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [rootMargin]);

  return (
    <div ref={ref} className="flex h-full w-full items-center justify-center">
      {visible ? children : placeholder}
    </div>
  );
}
```

**Verify**: `pnpm typecheck` → exit 0.

### Step 2: Wrap only the two WebGL render functions

In `components/landing/landing-page.tsx`, import `DeferredMount` and wrap the
`render` outputs for `ChromeButton` and `EvilEyeButton` only. Provide a static
placeholder so the cell isn't empty before mount (a simple styled box or the
button's label text). Example for the Chrome entry:

```tsx
render: () => (
  <DeferredMount placeholder={<ChromePlaceholder label="Chromy" />}>
    <ChromeButton>Chromy</ChromeButton>
  </DeferredMount>
),
```

Define small placeholder components (or reuse one generic placeholder) that
visually approximate the button footprint so `FitToContainer` measurement and
the grid layout don't jump. Do NOT wrap the other 19 entries.

**Verify**: `pnpm typecheck` → exit 0; `pnpm lint` → exit 0.

### Step 3: Manual behavior check

With `pnpm dev`:
1. Load `/`. The Chrome/EvilEye cells show their placeholder until scrolled near,
   then the live shader appears. No layout shift when they swap in.
2. Scroll them well out of view (> the 200px margin) and back; confirm via the
   Performance panel that GPU/scripting activity drops while they're unmounted.
3. Toggle OS "reduce motion" on and reload: `EvilEyeButton` still renders its
   static CSS eye (the reduced-motion path is preserved because the button
   component is unchanged).

**Verify**: all three behaviors hold; record the before/after idle CPU/GPU from
Step 0 vs now.

### Step 4: Build

**Verify**: `pnpm build` → exit 0.

## Test plan

No unit-test harness exists for the landing page; verification is the manual
profiler comparison in Steps 0 and 3 plus typecheck/lint/build. Document the
measured idle-activity delta in the PR description. (Do not add a heavyweight
browser-test setup for this single page under this plan.)

## Done criteria

ALL must hold:

- [ ] `DeferredMount` exists and is used to wrap ONLY the Chrome and EvilEye cells
- [ ] The other 19 showcase entries are unchanged
- [ ] Placeholders prevent visible layout shift when the WebGL buttons mount
- [ ] `EvilEyeButton`'s reduced-motion static path still works
- [ ] `pnpm typecheck`, `pnpm lint`, and `pnpm build` all exit 0
- [ ] Measured idle GPU/CPU is lower with the WebGL cells off-screen (Step 3)
- [ ] No changes to `components/LiquidChrome.tsx`, `components/EvilEye.tsx`, or the two button `.tsx` files
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- Step 0 shows idle WebGL activity is already negligible — the optimization isn't
  worth it; report and stop.
- Wrapping causes a visible layout jump that placeholders can't resolve (likely a
  `FitToContainer` interaction) — report rather than restructuring `FitToContainer`
  (out of scope).
- Unmounting a shader leaves a leaked WebGL context (check
  `chrome://gpu` / repeated context-lost warnings) — that would indicate the
  cleanup in `LiquidChrome`/`EvilEye` is insufficient; report it as a separate bug.

## Maintenance notes

- If more WebGL/shader buttons are added to the showcase later, wrap them in
  `DeferredMount` too.
- `DeferredMount` is landing-only; it must never be imported by a registry
  component (that would change what `shadcn add` ships).
- Reviewer should scrutinize the placeholders for layout-shift parity and confirm
  the reduced-motion path.
