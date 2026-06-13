# Plan 005: Single source of truth for component registration

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat da89f42..HEAD -- scripts/build-registry.mjs scripts/test-registry.mjs components/mdx-custom-components.tsx components/landing/landing-page.tsx`
> If any changed since this plan was written, re-read them and compare against
> the "Current state" excerpts; on a mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED
- **Depends on**: plans/004-data-driven-registry-builder.md
- **Category**: tech-debt
- **Planned at**: commit `da89f42`, 2026-06-13

## Why this matters

Adding a component today means editing it in **four** independently-maintained
places, and there is no check that they agree:

1. `scripts/build-registry.mjs` — the registry manifest (plan 004 collapses this
   into one array).
2. `components/mdx-custom-components.tsx` — import + registration so the docs
   MDX can render the component.
3. `components/landing/landing-page.tsx` — import + a `showcase` entry.
4. `content/docs/<slug>.mdx` — the docs page (scaffolded by the
   `evil-button-docs` skill).

`scripts/test-registry.mjs` validates #1 and #4 (registry JSON freshness + that
a doc references `@evilbuttons/<name>`), but it does **not** check #2 or #3 — so
a contributor can ship a component that's missing from the docs renderer or the
landing grid and every test still passes. There is even an existing latent
inconsistency: `glitch-button` is imported as a **default** export in the
landing page but as a **named** export in the MDX components file. This plan
makes one manifest the single source of truth and adds a guard test so the four
registration points can never silently drift again.

This plan deliberately does NOT auto-generate the landing `render()` functions —
each has bespoke props (e.g. `CommandButton shortcut="mod+s"`,
`CopyButton value=...`, `RevealButton label=...`) that aren't worth encoding.
Instead it centralizes the *metadata* and *enforces coverage*.

## Current state

- The registry manifest after plan 004 lives in `scripts/build-registry.mjs` as a
  `components` array (see plan 004). This plan moves that data to a shared file.
- MDX registration maps component identifiers (note the `EvilButton` alias and
  the mixed default/named imports):

```86:114:components/mdx-custom-components.tsx
export function getCustomMDXComponents(): MDXComponents {
  return {
    PreviewCard,
    Cmd,
    CodeBlock,
    ClickPowerUp,
    StickyButton,
    ShinyButton,
    MoviePassButton,
    MinimalButton,
    EvilButton: ClickPowerUp,
    GridButton,
    DitherButton,
    EvilEyeButton,
    Link,
    TrollButton,
    ChromeButton,
    BrutalButton,
    AquaButton,
    ThreeDButton,
    FrameButton,
    HighlightButton,
    GlitchButton,
    CommandButton,
    CopyButton,
    RevealButton,
    DemonicButton,
    HoldButton,
  };
}
```

- Landing registration is a `showcase` array of `{ name, href, registryName, render }`:

```39:62:components/landing/landing-page.tsx
const showcase: ButtonShowcase[] = [
  {
    name: "RevealButton",
    href: "/docs/reveal-button",
    registryName: "reveal-button",
    render: () => <RevealButton label="Hold to reveal" />,
  },
```

- `test-registry.mjs` currently ends after the JSON/doc checks:

```106:123:scripts/test-registry.mjs
  const hasDoc = docContents.some(({ content }) =>
    content.includes(`@evilbuttons/${name}`),
  );

  if (!hasDoc) {
    fail(`No docs page references @evilbuttons/${name}`);
  }
}

if (errors.length > 0) {
  console.error("Registry test failed:\n");
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log(`Registry test passed (${indexNames.length} items).`);
```

- `tsconfig.json` has `"resolveJsonModule": true`, so a `.json` manifest can be
  imported by both the `.mjs` build scripts (via `readFile`/`JSON.parse`) and by
  TypeScript files. Component **identifiers** (the actual imports + render
  functions) must stay in `.tsx`; only the metadata is centralized.

### Per-component metadata (the source-of-truth data)

`registryName` → `exportName` (the identifier used in mdx/landing) → `docSlug`
(the `content/docs/<docSlug>.mdx` filename). Compiled from the current files:

| registryName | exportName | docSlug |
|---|---|---|
| click-powerup | ClickPowerUp | click-power-up |
| sticky | StickyButton | sticky-button |
| shiny-button | ShinyButton | shiny-button |
| movie-pass | MoviePassButton | movie-pass |
| minimal | MinimalButton | minimal-button |
| grid-button | GridButton | grid-button |
| dither-button | DitherButton | dither-button |
| evil-eye-button | EvilEyeButton | evil-eye-button |
| troll-button | TrollButton | troll-button |
| chrome-button | ChromeButton | chrome-button |
| brutal-button | BrutalButton | brutal-button |
| aqua-button | AquaButton | aqua-button |
| 3d-button | ThreeDButton | 3d-button |
| frame-button | FrameButton | frame-button |
| highlight-button | HighlightButton | highlight-button |
| glitch-button | GlitchButton | glitch-button |
| command-button | CommandButton | command-button |
| copy-button | CopyButton | copy-button |
| reveal-button | RevealButton | reveal-button |
| demonic-button | DemonicButton | demonic-button |
| hold-button | HoldButton | hold-button |

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Install | `pnpm install --frozen-lockfile` | exit 0 |
| Build registry | `pnpm registry:build` | "Registry built:" list |
| Registry test | `pnpm registry:test` | `Registry test passed (21 items).` |
| Diff guard | `git diff public/r` | empty after rebuild |
| Typecheck | `pnpm typecheck` | exit 0 (requires plan 002) |

## Scope

**In scope**:
- `registry.components.json` (create — the shared manifest)
- `scripts/build-registry.mjs` (consume the manifest instead of an inline array)
- `scripts/test-registry.mjs` (add the coverage checks)

**Out of scope** (do NOT touch unless a coverage check legitimately fails):
- `components/landing/landing-page.tsx` and
  `components/mdx-custom-components.tsx` — do NOT rewrite their imports/renders.
  Only add a missing registration if the new test flags a genuine gap, and if so,
  STOP and report first.
- `public/r/*.json` — generated; must stay byte-identical.
- Component `.tsx` files.

## Git workflow

- Branch: `advisor/005-single-source-of-truth`
- Commit message: `refactor(registry): centralize component manifest and enforce registration coverage`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Create the shared manifest

Create `registry.components.json` at the repo root. It is the plan-004 `components`
array, extended with `exportName` and `docSlug` from the table above, in the
**same order** as the current `index.items`. Shape (showing the dependency
fields exactly as plan 004 established them):

```json
[
  {
    "name": "click-powerup",
    "exportName": "ClickPowerUp",
    "docSlug": "click-power-up",
    "title": "ClickPowerUp",
    "description": "An animated button wrapper with corner brackets, patterned fill, and tap feedback.",
    "file": "components/evil-buttons/click-powerup.tsx",
    "dependencies": ["motion", "clsx", "tailwind-merge"]
  }
]
```

Carry `registryDependencies` only for the items that have it (minimal,
grid-button, evil-eye-button, troll-button, chrome-button, highlight-button —
see plan 004). Copy all titles/descriptions/deps verbatim.

**Verify**: `node -e "const m=require('./registry.components.json'); console.log(m.length, m.every(c=>c.name&&c.exportName&&c.docSlug&&c.file))"`
→ prints `21 true`.

### Step 2: Make `build-registry.mjs` consume the manifest

In `scripts/build-registry.mjs`, replace the inline `components` array (from plan
004) with a read of the JSON file:

```js
import { readFile } from "node:fs/promises";
// ...
const components = JSON.parse(
  await readFile(resolve(root, "registry.components.json"), "utf8"),
);
```

The build loop is unchanged. The extra `exportName`/`docSlug` fields are ignored
by the registry output (the item/index builders only read
`name`/`title`/`description`/`file`/`dependencies`/`registryDependencies`).

**Verify**: `pnpm registry:build` then `git diff public/r` → **empty** (output
must remain byte-identical to plan 004's).

### Step 3: Add coverage checks to `test-registry.mjs`

In `scripts/test-registry.mjs`, after reading `index`, also read the manifest and
the two registration files, and assert each component is referenced. Add near the
top (after `const index = JSON.parse(indexRaw);`):

```js
const manifest = JSON.parse(
  await readFile(resolve(root, "registry.components.json"), "utf8"),
);
const mdxSource = await readFile(
  resolve(root, "components/mdx-custom-components.tsx"),
  "utf8",
);
const landingSource = await readFile(
  resolve(root, "components/landing/landing-page.tsx"),
  "utf8",
);
```

Then, in the loop over `indexNames` (or a dedicated loop over `manifest`), add:

```js
const entry = manifest.find((c) => c.name === name);
if (!entry) {
  fail(`registry.components.json has no entry for "${name}"`);
} else {
  // Word-boundary match so "GridButton" doesn't satisfy "Button".
  const token = new RegExp(`\\b${entry.exportName}\\b`);
  if (!token.test(mdxSource)) {
    fail(`components/mdx-custom-components.tsx does not reference ${entry.exportName} (${name})`);
  }
  if (!token.test(landingSource)) {
    fail(`components/landing/landing-page.tsx does not reference ${entry.exportName} (${name})`);
  }
}
```

Also assert the manifest and the index agree on the set of names (catches a
manifest entry with no JSON, or vice versa):

```js
const manifestNames = manifest.map((c) => c.name);
for (const name of manifestNames) {
  if (!indexNames.includes(name)) fail(`Manifest item not in index.json: ${name}`);
}
for (const name of indexNames) {
  if (!manifestNames.includes(name)) fail(`index.json item not in manifest: ${name}`);
}
```

**Verify**: `pnpm registry:test` → `Registry test passed (21 items).`
The checks should pass against the current code (every component IS registered
today). If any FAILS, that's a real pre-existing gap → STOP and report which
component/file before adding the registration.

### Step 4: Full verification

Run in order, all must pass:
1. `pnpm registry:build` → `git diff public/r` empty
2. `pnpm registry:test` → passed (21 items)
3. `pnpm typecheck` → exit 0 (requires plan 002; if not landed, run `pnpm build`)
4. `pnpm lint` → exit 0

## Test plan

The test IS the deliverable here: `scripts/test-registry.mjs` now fails if a
component is missing from the registry JSON, the docs, the MDX renderer, or the
landing grid. To self-verify the new check actually catches gaps (do this,
then revert):
- Temporarily comment out one `exportName` usage in `landing-page.tsx`,
  run `pnpm registry:test`, confirm it FAILS naming that component, then restore
  the line and confirm it passes. (Restore is mandatory — do not commit the
  temporary edit.)

## Done criteria

ALL must hold:

- [ ] `registry.components.json` exists with 21 entries, each having `name`, `exportName`, `docSlug`, `title`, `description`, `file`, `dependencies`
- [ ] `scripts/build-registry.mjs` reads the manifest from the JSON file (no inline component array)
- [ ] `pnpm registry:build` produces an **empty** `git diff public/r`
- [ ] `scripts/test-registry.mjs` checks mdx + landing coverage and manifest↔index parity
- [ ] `pnpm registry:test` prints `Registry test passed (21 items).`
- [ ] `pnpm typecheck` (or `pnpm build`) and `pnpm lint` exit 0
- [ ] No component `.tsx` rewritten; `public/r` unchanged
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- `pnpm registry:build` produces a non-empty `public/r` diff (manifest data
  doesn't match the current JSON exactly — fix the manifest, but if you can't
  reconcile, report).
- The new coverage check fails for a component on the current code (a genuine
  pre-existing registration gap) — report which component and file rather than
  silently adding the registration.
- The `glitch-button` default-vs-named import discrepancy turns out to be a real
  type error surfaced by `pnpm typecheck` — report it (it's a separate fix).

## Maintenance notes

- After this, adding a component is: (1) add the `.tsx`, (2) add one manifest
  entry, (3) add the import + render in mdx + landing, (4) run
  `pnpm registry:build`. Steps 1/3/4 are now *enforced* by `registry:test` — you
  can't forget the docs, the MDX renderer, or the landing grid.
- Plan 008 designs a generator that performs steps 2–4 automatically, writing
  into this manifest. Keep the JSON shape stable for that.
- Reviewer should confirm `public/r` is unchanged and the new test fails when a
  registration is removed (the Step-4/test-plan self-check).
