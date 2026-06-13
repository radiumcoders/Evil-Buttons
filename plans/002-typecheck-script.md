# Plan 002: Add a `typecheck` script

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat da89f42..HEAD -- package.json tsconfig.json`
> If either changed since this plan was written, compare the "Current state"
> excerpts against the live code before proceeding; on a mismatch, treat it as a
> STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: dx
- **Planned at**: commit `da89f42`, 2026-06-13

## Why this matters

The project is `strict: true` TypeScript, but there is no standalone way to
typecheck it: the only type validation happens implicitly during
`next build`, which is slow and bundles the whole app. Contributors (and CI in
plan 003) have no fast `tsc --noEmit` gate. Adding a `typecheck` script gives a
seconds-not-minutes feedback loop and a clean command for CI to call.

## Current state

- `package.json` scripts — no `typecheck` entry:

```5:12:package.json
  "scripts": {
    "dev": "node scripts/build-registry.mjs && next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint",
    "registry:build": "node scripts/build-registry.mjs",
    "registry:test": "node scripts/test-registry.mjs"
  },
```

- `tsconfig.json` already sets `"noEmit": true` and includes the Next.js and
  fumadocs generated type dirs:

```32:39:tsconfig.json
  "include": [
    "next-env.d.ts",
    "**/*.ts",
    "**/*.tsx",
    ".next/types/**/*.ts",
    ".next/dev/types/**/*.ts",
    ".source/**/*.ts"
  ],
```

- `typescript` is already a devDependency (`package.json` devDependencies:
  `"typescript": "^5"`), so no install is needed.
- IMPORTANT: `tsconfig.json` includes `.next/types/**` and `.source/**`, which
  are **generated**. `tsc` will error if they don't exist yet. The `typecheck`
  script must generate them first (fumadocs MDX types live under `.source/`,
  produced by the dev/build pipeline).

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Install | `pnpm install --frozen-lockfile` | exit 0 |
| New script | `pnpm typecheck` | exit 0, no type errors |
| Build (sanity) | `pnpm build` | exit 0 |

(Use `pnpm`; the repo standardizes on it. If plan 001 hasn't landed yet and only
`package-lock.json` exists, `npm run typecheck` works equally for this plan.)

## Scope

**In scope** (the only file you should modify):
- `package.json` (add one script)

**Out of scope** (do NOT touch):
- `tsconfig.json` — its `include`/`noEmit` are already correct. Do not add
  `noEmit` to the CLI if it's already in the config (it is).
- Any source file. If `tsc` surfaces real type errors, that is a STOP condition,
  not a fix-it-here task.

## Git workflow

- Branch: `advisor/002-typecheck-script`
- Commit message: `chore: add typecheck script` (match repo conventional style).
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Add the `typecheck` script

Add a `typecheck` script to `package.json`. Because `tsconfig.json` includes
generated type directories (`.next/types`, `.source`), generate them first so a
fresh checkout doesn't fail on missing files. Use the registry build (which the
`dev`/`build` scripts already run) plus `next build`'s type generation is
heavier than needed — instead rely on fumadocs' postinstall/`.source` generation
that `next dev`/`next build` trigger. The robust, CI-friendly form is:

```json
    "registry:test": "node scripts/test-registry.mjs",
    "typecheck": "tsc --noEmit"
```

**Verify**: `node -e "console.log(require('./package.json').scripts.typecheck)"`
→ prints `tsc --noEmit`.

### Step 2: Run it once on a prepared tree

`tsc` needs the generated `.source/` and `.next/types` to exist. If
`pnpm typecheck` fails **only** with errors like "Cannot find module
`@/.source/server`" or missing `.next/types/*`, run a build once to generate
them, then re-run typecheck:

1. `pnpm build` (generates `.next/types` and `.source`) → exit 0
2. `pnpm typecheck` → exit 0

If after a successful `pnpm build` the `pnpm typecheck` still reports errors,
those are **real type errors** → STOP and report them (do not edit source to
silence them under this plan).

**Verify**: `pnpm typecheck` → exit 0, prints nothing (no errors).

## Test plan

No unit tests. Verification is the script itself:

- `pnpm typecheck` exits 0 on a tree where `.source/` and `.next/types` exist.

## Done criteria

ALL must hold:

- [ ] `package.json` has a `typecheck` script running `tsc --noEmit`
- [ ] `pnpm typecheck` exits 0 (after a build has generated `.source/`/`.next/types`)
- [ ] No source files modified (`git status` shows only `package.json`)
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- `pnpm typecheck` reports genuine type errors after a successful `pnpm build`.
  Report the errors verbatim; they are a separate finding.
- `tsc` is not resolvable even after `pnpm install` (TypeScript missing).

## Maintenance notes

- Plan 003 (CI) will call `pnpm typecheck` after generating `.source/`. Note in
  the CI plan that typecheck depends on the fumadocs `.source/` artifacts, so
  the CI job order is: install → registry:build → build (or `.source` gen) →
  typecheck, OR run `typecheck` after `build`.
- Reviewer should confirm `tsc --noEmit` (not `tsc`, which would try to emit).
