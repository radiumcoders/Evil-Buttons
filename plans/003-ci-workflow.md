# Plan 003: Add CI that runs lint, typecheck, registry test, and build

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat da89f42..HEAD -- package.json .github`
> If anything changed, re-read the live `package.json` scripts before writing the
> workflow; on a mismatch with the excerpts below, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: plans/001-single-lockfile.md, plans/002-typecheck-script.md
- **Category**: dx
- **Planned at**: commit `da89f42`, 2026-06-13

## Why this matters

There is no CI in this repo (no `.github/workflows`). The project ships a
`registry:test` script whose entire purpose is to catch stale generated registry
JSON in `public/r/*.json` — but nothing runs it automatically, so a contributor
can commit a component whose registry JSON is out of date (or whose docs are
missing) and nobody notices until a user's `shadcn add` pulls broken content.
The same is true for lint and types. A small GitHub Actions workflow that runs on
every push/PR closes this gap and makes the registry's correctness an enforced
invariant.

## Current state

- No `.github/` directory exists.
- The scripts CI should run (from `package.json`), assuming plan 002 has added
  `typecheck`:

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

- `registry:test` (`scripts/test-registry.mjs`) compares each embedded source in
  `public/r/*.json` against the live component file and fails if stale:

```89:94:scripts/test-registry.mjs
      } else if (embedded !== source) {
        fail(
          `public/r/${name}.json is stale for ${fileEntry.path}. Run pnpm registry:build`,
        );
      }
```

  So CI should run `registry:build` then `registry:test` (or just
  `registry:test` if we want CI to *fail* on stale committed JSON — see Step 1).
- The repo standardizes on pnpm (plan 001): `packageManager: "pnpm@9.*"`,
  `pnpm-lock.yaml` at `lockfileVersion: '9.0'`.
- `pnpm typecheck` depends on the fumadocs-generated `.source/` directory and
  `.next/types` (see plan 002), which `next build` produces. So CI must build
  before (or as part of) typecheck, or run typecheck after build.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Install | `pnpm install --frozen-lockfile` | exit 0 |
| Lint | `pnpm lint` | exit 0 |
| Registry check | `pnpm registry:test` | "Registry test passed (N items)." |
| Build | `pnpm build` | exit 0 |
| Typecheck | `pnpm typecheck` | exit 0 |

## Scope

**In scope** (create only):
- `.github/workflows/ci.yml`

**Out of scope** (do NOT touch):
- Any `package.json` script (plan 002 owns `typecheck`; do not redefine it here).
- Deployment/release config — this plan adds CI checks only, no publishing.

## Git workflow

- Branch: `advisor/003-ci-workflow`
- Commit message: `ci: add lint, typecheck, registry, and build checks`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Decide the registry-staleness policy

CI should **fail** if committed `public/r/*.json` is stale. To do that, run
`pnpm registry:test` directly (do NOT run `registry:build` first in CI, or it
would regenerate the JSON and mask staleness). The workflow below runs
`registry:test` against the committed JSON.

### Step 2: Create the workflow file

Create `.github/workflows/ci.yml`:

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm

      - name: Install
        run: pnpm install --frozen-lockfile

      - name: Lint
        run: pnpm lint

      - name: Registry is up to date
        run: pnpm registry:test

      - name: Build
        run: pnpm build

      - name: Typecheck
        run: pnpm typecheck
```

Notes for the executor:
- `pnpm/action-setup@v4` reads the `packageManager` field from `package.json`
  (added in plan 001) to pick the pnpm version. If plan 001 has NOT landed and
  there is no `packageManager` field, add `with: { version: 9 }` to the
  `pnpm/action-setup` step. Confirm which case applies before finishing.
- `Typecheck` runs after `Build` on purpose: `tsc` needs the `.source/` and
  `.next/types` artifacts that `pnpm build` generates (see plan 002). Do not
  reorder it before `Build`.
- Node 20 matches `@types/node: ^20`.

**Verify (local dry run of the same commands)**: run each command locally in
order and confirm all exit 0:
1. `pnpm install --frozen-lockfile`
2. `pnpm lint`
3. `pnpm registry:test` → `Registry test passed (21 items).`
4. `pnpm build`
5. `pnpm typecheck`

### Step 3: Validate the YAML

**Verify**: the file parses as YAML. If `node` has no YAML parser available,
confirm indentation is two-space and there are no tab characters:
`Select-String -Path .github/workflows/ci.yml -Pattern "`t"` (PowerShell) returns
nothing.

## Test plan

CI itself is the test. Locally, the five commands in Step 2's verify block must
all pass — that is exactly what the workflow runs. There are no unit tests to add.

## Done criteria

ALL must hold:

- [ ] `.github/workflows/ci.yml` exists and is valid YAML (two-space indent, no tabs)
- [ ] Running the five commands locally in the workflow order all exit 0
- [ ] `pnpm registry:test` prints `Registry test passed (21 items).`
- [ ] The workflow does NOT run `registry:build` (it must validate committed JSON)
- [ ] No files outside `.github/workflows/ci.yml` are modified
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- `pnpm registry:test` fails locally on the committed tree (means `public/r/*.json`
  is already stale — report it; do NOT run `registry:build` to paper over it,
  that's a separate fix and would hide the very problem CI exists to catch).
- `pnpm build` or `pnpm typecheck` fails locally — CI would be red on day one;
  report the failure instead of weakening the workflow to skip the failing step.
- This repo uses a CI provider other than GitHub Actions (check for
  `.gitlab-ci.yml`, `.circleci/`, etc.). If so, STOP and ask which provider to
  target.

## Maintenance notes

- When a new component is added, this workflow will now fail the PR unless
  `pnpm registry:build` was run and the regenerated JSON committed — that's the
  intended behavior.
- If plan 005 introduces a manifest-driven build, no CI change is needed:
  `registry:test` still validates the committed output.
- Reviewer should confirm the `Typecheck` step stays after `Build`.
