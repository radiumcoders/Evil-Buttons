# Plan 004: Refactor `build-registry.mjs` to a data-driven loop

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat da89f42..HEAD -- scripts/build-registry.mjs scripts/test-registry.mjs public/r`
> If `scripts/build-registry.mjs` changed since this plan was written, compare
> the "Current state" excerpts against the live file before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED
- **Depends on**: none (but land plans 002/003 first so typecheck + CI guard you)
- **Category**: tech-debt
- **Planned at**: commit `da89f42`, 2026-06-13

## Why this matters

`scripts/build-registry.mjs` is ~788 lines of near-identical, hand-maintained
blocks: for each of the 21 components it has a separate `readFile`, a separate
item object, a separate entry in the `index.items` array, a separate `writeFile`,
and a separate `console.log`. Adding one component means editing the file in
**five** places, and the per-item object and the `index.items` entry duplicate
the same `name`/`title`/`description`/`files` by hand — an easy place to let them
silently diverge. Collapsing this into a single component manifest plus one loop
removes the duplication and makes the file's behavior obvious. The output JSON
must be **byte-for-byte identical** so `registry:test` and existing consumers
keep passing — this is a pure refactor.

## Current state

The script reads each source, then builds two parallel structures. Representative
excerpts:

- Per-component source read (21 of these):

```10:13:scripts/build-registry.mjs
const clickPowerupSource = await readFile(
  resolve(root, "components/evil-buttons/click-powerup.tsx"),
  "utf8",
);
```

- Per-component registry item object (21 of these), e.g. one with both
  `registryDependencies` and `dependencies`:

```167:186:scripts/build-registry.mjs
const minimalItem = {
  $schema: "https://ui.shadcn.com/schema/registry-item.json",
  name: "minimal",
  type: "registry:ui",
  title: "MinimalButton",
  description:
    "A sleek, minimal button with a subtle repeating linear gradient pattern.",
  files: [
    {
      path: "components/evil-buttons/minimal.tsx",
      type: "registry:ui",
      target: "components/evil-buttons/minimal.tsx",
      content: minimalSource,
    },
  ],
  registryDependencies: [
    "button"
  ],
  dependencies: ["clsx", "tailwind-merge"],
};
```

- The `index` object listing every item again (name/type/title/description/files):

```479:507:scripts/build-registry.mjs
const index = {
  $schema: "https://ui.shadcn.com/schema/registry.json",
  name: "evil-buttons",
  homepage: "http://evilbuttons.radiumcoders.com/docs",
  items: [
    {
      name: "click-powerup",
      type: "registry:ui",
      title: "ClickPowerUp",
      description:
        "An animated button wrapper with corner brackets, patterned fill, and tap feedback.",
      files: ["components/evil-buttons/click-powerup.tsx"],
    },
```

- Per-component write + log (21 each):

```654:658:scripts/build-registry.mjs
await writeFile(
  resolve(registryDir, "click-powerup.json"),
  `${JSON.stringify(clickPowerupItem, null, 2)}\n`,
  "utf8",
);
```

Key invariants the refactor MUST preserve (verified from the current file):
- Each item file is `${JSON.stringify(item, null, 2)}\n` (2-space indent, trailing newline).
- `index.json` is `${JSON.stringify(index, null, 2)}\n`.
- Item object key order is exactly: `$schema`, `name`, `type`, `title`,
  `description`, `files`, then **optionally** `registryDependencies`, then
  **optionally** `dependencies`. `JSON.stringify` preserves insertion order, so
  the manifest/loop must insert keys in this order and only include
  `registryDependencies`/`dependencies` for items that currently have them.
- `files[0]` is always `{ path, type: "registry:ui", target: <same as path>, content }`.
- `index.items[*]` contains only `{ name, type, title, description, files: [path] }`
  (NO dependencies, NO content).
- `index.homepage` is `"http://evilbuttons.radiumcoders.com/docs"`.

Per-component data (name, title, description, deps, registryDeps) is the source
of truth in the current file — copy it verbatim into the manifest; do not
reword any description.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Install | `pnpm install --frozen-lockfile` | exit 0 |
| Build registry | `pnpm registry:build` | prints "Registry built:" list |
| Registry test | `pnpm registry:test` | `Registry test passed (21 items).` |
| Diff guard | `git diff --stat public/r` | **no changes** after rebuild (see Step 1) |

## Scope

**In scope** (the only file you should modify):
- `scripts/build-registry.mjs`

**Out of scope** (do NOT touch):
- `public/r/*.json` — these are generated. You must NOT hand-edit them. After
  the refactor they must be regenerated identically (Step 4 checks this).
- `scripts/test-registry.mjs` — the validator stays as is.
- Any component `.tsx` file.

## Git workflow

- Branch: `advisor/004-data-driven-registry-builder`
- Commit message: `refactor(registry): generate registry from a component manifest`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Capture the current output as a baseline

Before changing anything, confirm the committed JSON matches the current script,
so you can detect any drift you introduce:

1. `git stash` is NOT needed; just record the baseline:
   `git status --short public/r` → should be clean (no pending changes).
2. `pnpm registry:build`
3. `git diff --stat public/r` → **no changes**. If there ARE changes, the
   committed JSON was already stale → STOP and report (do not proceed; that's
   plan 003 territory).

### Step 2: Build the manifest

At the top of `scripts/build-registry.mjs`, after the `registryDir` definition,
replace the 21 individual `readFile`/item/index blocks with a single manifest
array. Each entry carries exactly the per-component data. Shape:

```js
// One entry per registry item. Order matches the current index.items order.
const components = [
  {
    name: "click-powerup",
    title: "ClickPowerUp",
    description:
      "An animated button wrapper with corner brackets, patterned fill, and tap feedback.",
    file: "components/evil-buttons/click-powerup.tsx",
    dependencies: ["motion", "clsx", "tailwind-merge"],
    // registryDependencies: ["button"],  // include ONLY when present today
  },
  // ... all 21, in the SAME order as the current index.items ...
];
```

Rules:
- **Preserve the exact order** of the current `index.items` (click-powerup,
  sticky, shiny-button, movie-pass, minimal, grid-button, dither-button,
  evil-eye-button, troll-button, chrome-button, brutal-button, aqua-button,
  3d-button, frame-button, highlight-button, glitch-button, command-button,
  copy-button, reveal-button, demonic-button, hold-button).
- Copy `title`, `description`, `dependencies`, and `registryDependencies`
  **verbatim** from the current per-item objects. Items that have NO
  `dependencies` today (e.g. `shiny-button`, `movie-pass`, `chrome-button`) must
  keep `dependencies: []`. Items with `registryDependencies` today: `minimal`
  (`["button"]`), `grid-button` (`["@dotmatrix/dotm-square-11"]`),
  `evil-eye-button` (`["@react-bits/EvilEye-TS-TW"]`), `troll-button`
  (`["button"]`), `chrome-button` (`["@react-bits/LiquidChrome-TS-TW"]`),
  `highlight-button` (`["button"]`). All others have none.

### Step 3: Generate from the manifest

Replace the per-item objects, the `index` literal, and the per-file writes with
two loops. The item-building function must reproduce the exact key order and the
optional-deps rule:

```js
function buildItem({ name, title, description, file, dependencies, registryDependencies }, content) {
  const item = {
    $schema: "https://ui.shadcn.com/schema/registry-item.json",
    name,
    type: "registry:ui",
    title,
    description,
    files: [{ path: file, type: "registry:ui", target: file, content }],
  };
  if (registryDependencies?.length) item.registryDependencies = registryDependencies;
  if (dependencies) item.dependencies = dependencies; // keep [] when present today
  return item;
}
```

IMPORTANT nuance on `dependencies`: in the current file, items that have an
empty list still emit `"dependencies": []` (e.g. shiny-button), while items that
truly omit deps do not exist — every current item has a `dependencies` key
EXCEPT none. Re-check: every item object in the current file has a
`dependencies` array (some `[]`). So always emit `dependencies` (default to `[]`
in the manifest) to match. `registryDependencies` is emitted ONLY when present.

Then:

```js
await mkdir(registryDir, { recursive: true });

const builtItems = [];
for (const component of components) {
  const content = await readFile(resolve(root, component.file), "utf8");
  const item = buildItem(component, content);
  builtItems.push(item);
  await writeFile(
    resolve(registryDir, `${component.name}.json`),
    `${JSON.stringify(item, null, 2)}\n`,
    "utf8",
  );
}

const index = {
  $schema: "https://ui.shadcn.com/schema/registry.json",
  name: "evil-buttons",
  homepage: "http://evilbuttons.radiumcoders.com/docs",
  items: components.map(({ name, title, description, file }) => ({
    name,
    type: "registry:ui",
    title,
    description,
    files: [file],
  })),
};

await writeFile(
  resolve(registryDir, "index.json"),
  `${JSON.stringify(index, null, 2)}\n`,
  "utf8",
);

console.log("Registry built:");
console.log("- public/r/index.json");
for (const { name } of components) console.log(`- public/r/${name}.json`);
```

### Step 4: Prove the output is byte-identical

This is the whole point — the refactor must not change a single byte of output.

1. `pnpm registry:build`
2. `git diff public/r` → **completely empty** (no diff). If anything differs,
   inspect the diff: the usual culprits are key order, a missing/extra
   `dependencies: []`, or a reworded description. Fix the manifest/loop until the
   diff is empty.

**Verify**: `git diff --stat public/r` → no output (zero files changed).

### Step 5: Run the validator

**Verify**: `pnpm registry:test` → `Registry test passed (21 items).`

## Test plan

The existing `scripts/test-registry.mjs` is the test. Additionally, the
byte-identical diff check in Step 4 is the strongest guarantee. No new tests to
write (this is a build script with no unit harness). If desired, the executor may
note that a future test could snapshot `public/r/index.json`, but that is out of
scope here.

## Done criteria

ALL must hold:

- [ ] `scripts/build-registry.mjs` defines a single `components` manifest array of 21 entries
- [ ] No per-component `const xSource = await readFile(...)` / `const xItem = {...}` blocks remain
- [ ] `pnpm registry:build` runs and `git diff public/r` is **empty**
- [ ] `pnpm registry:test` prints `Registry test passed (21 items).`
- [ ] Only `scripts/build-registry.mjs` is modified (`git status` — `public/r` unchanged)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- The baseline check in Step 1 shows `public/r` was already stale before your
  changes (report it; do not "fix" it under this refactor).
- After your best effort the `git diff public/r` is non-empty due to a structural
  difference you can't reconcile (e.g. an item whose current key order differs
  from the others) — report the specific item and diff.
- You discover a component file referenced by the manifest does not exist on disk.

## Maintenance notes

- Plan 005 extends this same `components` manifest to also drive the MDX and
  landing-page registrations, so keep the manifest export-friendly (a plain
  array of plain objects). If convenient, the executor of 005 may move the array
  into a shared module; do not pre-optimize for that here.
- Reviewer should diff `public/r` (must be empty) rather than reading the script
  line by line — the empty diff is the proof of correctness.
