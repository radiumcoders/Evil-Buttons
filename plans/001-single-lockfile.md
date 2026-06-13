# Plan 001: Standardize on a single lockfile and pin the package manager

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat da89f42..HEAD -- package.json package-lock.json pnpm-lock.yaml README.md`
> If any of these changed since this plan was written, compare the "Current
> state" excerpts against the live code before proceeding; on a mismatch, treat
> it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: migration (dependency hygiene)
- **Planned at**: commit `da89f42`, 2026-06-13

## Why this matters

The repo commits **two lockfiles** — `package-lock.json` (npm) and
`pnpm-lock.yaml` (pnpm) — and they already disagree on resolved versions (for
example `shiki` is `4.0.2` in `pnpm-lock.yaml` but `4.2.0` in
`package-lock.json`). Whichever lockfile a contributor's package manager honors
determines their dependency tree, so two people running "install" can get
materially different `node_modules`, and the two files drift further apart on
every dependency change. The README already recommends pnpm. Keeping exactly one
lockfile, plus a `packageManager` field, makes installs deterministic and tells
every tool (and CI in plan 003) which manager to use.

## Current state

- `package.json` — no `packageManager` field today:

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

- Both lockfiles exist at the repo root: `package-lock.json` and
  `pnpm-lock.yaml`. `pnpm-lock.yaml` is `lockfileVersion: '9.0'` (pnpm 9.x).
- The README documents pnpm as the workflow:

```42:55:README.md
### Prerequisites
- pnpm (recommended)
### Setup
```bash
# Clone the repository
git clone https://github.com/radiumcoders/evil-buttons.git
cd evil-buttons

# Install dependencies
pnpm install

# Run development server
pnpm dev
```
```

**Decision: keep `pnpm-lock.yaml`, delete `package-lock.json`.** Rationale: the
README, dev scripts, and the `pnpm-lock.yaml` (lockfileVersion 9) already commit
the project to pnpm.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Install | `pnpm install --frozen-lockfile` | exit 0, no lockfile changes |
| Verify build | `pnpm build` | exit 0 |

(If `pnpm` is not installed in the executor environment, enable it with
`corepack enable` first. If corepack is unavailable, this is a STOP condition.)

## Scope

**In scope** (the only files you should modify/delete):
- `package-lock.json` (delete)
- `package.json` (add `packageManager` field)
- optionally create `.npmrc` (see Step 3)

**Out of scope** (do NOT touch):
- `pnpm-lock.yaml` — this is the lockfile we are keeping. Do not regenerate or
  reorder it beyond what `pnpm install` does naturally.
- Any dependency version in `package.json` `dependencies`/`devDependencies` —
  this plan does not upgrade anything.

## Git workflow

- Branch: `advisor/001-single-lockfile`
- Commit message style matches the repo's conventional-commits log
  (e.g. `chore: standardize on pnpm and remove package-lock.json`).
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Delete the npm lockfile

Delete `package-lock.json` from the repo root.

**Verify**: `git status --short` → shows `D package-lock.json` and no other
unexpected deletions.

### Step 2: Pin the package manager in `package.json`

Add a top-level `packageManager` field. Use the pnpm major that matches
`pnpm-lock.yaml`'s `lockfileVersion: '9.0'` (pnpm 9). Add it right after the
`"private": true` line:

```json
  "private": true,
  "packageManager": "pnpm@9.15.0",
```

(If a newer pnpm 9.x patch is the standard in the executor's environment, use
that exact `pnpm@9.x.y` string; do not jump to pnpm 10.)

**Verify**: `node -e "console.log(require('./package.json').packageManager)"` →
prints a `pnpm@9.*` string.

### Step 3: (Recommended) discourage accidental npm installs

Create `.npmrc` at the repo root with a single line so that running `npm install`
warns rather than silently producing a new `package-lock.json`:

```
engine-strict=true
```

This is optional; skip if `.npmrc` already exists with conflicting settings
(STOP and report if so).

**Verify**: `pnpm install --frozen-lockfile` → exit 0 with no changes to
`pnpm-lock.yaml` (`git status --short` shows `pnpm-lock.yaml` unmodified).

### Step 4: Confirm the build still works

**Verify**: `pnpm build` → exit 0.

## Test plan

There is no unit-test suite. Verification is install + build determinism:

- `pnpm install --frozen-lockfile` exits 0 and does not modify `pnpm-lock.yaml`.
- `pnpm build` exits 0.

## Done criteria

ALL must hold:

- [ ] `package-lock.json` no longer exists (`git status --short` shows it deleted)
- [ ] `package.json` has a `packageManager: "pnpm@9.*"` field
- [ ] `pnpm install --frozen-lockfile` exits 0 with no lockfile diff
- [ ] `pnpm build` exits 0
- [ ] No files outside the in-scope list are modified
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- `pnpm` cannot be made available (no corepack, no global pnpm).
- `pnpm install --frozen-lockfile` fails because `pnpm-lock.yaml` is itself out
  of date with `package.json` (this would mean the kept lockfile is stale — a
  separate problem; report it, do not run an unfrozen install to "fix" it).
- A `.npmrc` already exists with settings that conflict with `engine-strict`.

## Maintenance notes

- After this lands, CI (plan 003) must install with pnpm
  (`pnpm install --frozen-lockfile`).
- Reviewer should confirm only `package-lock.json` was deleted and no dependency
  versions changed.
- Follow-up deferred: actually upgrading drifted deps (e.g. shiki) is out of
  scope here — open a separate dependency-bump task if desired.
