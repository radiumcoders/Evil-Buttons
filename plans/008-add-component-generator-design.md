# Plan 008: Design a single `add-component` generator (spike)

> **Executor instructions**: This is a **design/spike** plan, not a
> build-everything plan. Your deliverable is a written design document plus a
> minimal prototype that proves the risky parts — NOT a finished, shipped
> generator. Follow the steps, answer the open questions with evidence from the
> codebase, and STOP at the boundaries below. When done, update the status row
> for this plan in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat da89f42..HEAD -- .agents/skills/evil-button-docs scripts registry.components.json`
> If the docs-generator skill or the manifest changed, re-read them before
> designing on top of them.

## Status

- **Priority**: P3
- **Effort**: M (design + prototype)
- **Risk**: LOW (design artifact; the prototype is gated)
- **Depends on**: plans/005-single-source-of-truth.md (the shared manifest is the target the generator writes into)
- **Category**: direction
- **Planned at**: commit `da89f42`, 2026-06-13

## Why this matters

The repo already has half a scaffolder: `.agents/skills/evil-button-docs/scripts/generate-docs.mjs`
generates a `content/docs/<slug>.mdx` from CLI flags, but it stops there — it
does NOT add the component to the registry manifest, the MDX renderer, or the
landing showcase. So the documented "add a component" workflow is still mostly
manual and easy to get half-right (the exact gap plan 005 enforces against).
A single `add-component` generator that performs all registration steps would
turn a 4-file chore into one command, lowering the barrier for contributions
(the project's stated goal — it's a community registry). This plan designs that
generator and de-risks it before anyone builds it.

## Current state

- The existing docs generator: flag parsing, defaulting, and an MDX template. It
  already knows most per-component fields the registry needs (name, title,
  description, deps, registry-deps, export style, doc slug):

```94:110:.agents/skills/evil-button-docs/scripts/generate-docs.mjs
const options = parseArgs(process.argv.slice(2));
const registryName = requireOption(options, "name");
const title = options.title ?? pascalCase(registryName);
const description = requireOption(options, "description");
const componentFile = options["component-file"] ?? registryName;
const componentName = options.component ?? title;
const docSlug = options["doc-slug"] ?? registryName;
const exportStyle = options.export ?? "named";
const deps = joinList(options.deps);
const registryDeps = joinList(options["registry-deps"]);
```

- After plan 005, the registry source of truth is `registry.components.json`
  (array of `{ name, exportName, docSlug, title, description, file,
  dependencies, registryDependencies? }`), consumed by
  `scripts/build-registry.mjs` and validated by `scripts/test-registry.mjs`
  (which now also checks MDX + landing coverage).
- The two TS registration points the generator must edit:
  - `components/mdx-custom-components.tsx` — an import line + a key in the object
    returned by `getCustomMDXComponents()`.
  - `components/landing/landing-page.tsx` — an import line + an entry in the
    `showcase` array (with a bespoke `render()` — see open question Q2).

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Existing generator (dry run) | `node .agents/skills/evil-button-docs/scripts/generate-docs.mjs --name demo --description "A demo." --dry-run` | prints MDX to stdout |
| Registry build | `pnpm registry:build` | regenerates `public/r` |
| Registry test | `pnpm registry:test` | passes |

## Scope

**In scope (design deliverables only):**
- A design document: `plans/008-design-notes.md` (you create this) covering the
  generator's CLI surface, the files it writes, and the editing strategy for the
  two TS files.
- A **minimal prototype** limited to the lowest-risk, highest-value step: a
  function/script that appends a new entry to `registry.components.json` from CLI
  flags and runs `pnpm registry:build` + `pnpm registry:test`. (This is the part
  with a clean verification story.)

**Explicitly OUT of scope for this plan (design them, do not build them):**
- Programmatic editing of `components/mdx-custom-components.tsx` and
  `components/landing/landing-page.tsx` (AST/codemod vs. string-anchor insertion
  is a real decision — design it, prototype only if time permits, and gate
  behind Q2/Q3 answers).
- Generating the component `.tsx` itself.
- Wiring this into the `evil-button-docs` skill flow.

## Git workflow

- Branch: `advisor/008-add-component-generator-design`
- Commit message: `docs(plan): design add-component generator + manifest-append prototype`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Inventory what the generator must produce

For a new component, list every artifact and the exact insertion point, citing
file + anchor. Confirm against the current code:
1. `components/evil-buttons/<file>.tsx` (component) — generated or hand-written?
2. `registry.components.json` — append one entry.
3. `components/mdx-custom-components.tsx` — import + object key.
4. `components/landing/landing-page.tsx` — import + `showcase` entry.
5. `content/docs/<docSlug>.mdx` — already handled by the existing generator.

Capture this as a table in `plans/008-design-notes.md`.

### Step 2: Answer the open questions (with codebase evidence)

- **Q1 — Manifest append**: Can the generator append to
  `registry.components.json` and reproduce byte-identical output? (It should:
  JSON with the same field order + `pnpm registry:build`.) Confirm.
- **Q2 — Landing `render()`**: The `showcase` entries have bespoke render
  functions (`CommandButton shortcut="mod+s"`, `CopyButton value=...`,
  `RevealButton label=...`). How should the generator emit a `render()`? Options:
  (a) a generic `() => <X>Label</X>` the author edits, (b) flags for common props.
  Recommend one with rationale.
- **Q3 — TS file editing strategy**: string-anchor insertion (find a sentinel
  comment, insert before it) vs. a TS AST codemod (`ts-morph`/compiler API).
  Weigh: the repo has no codemod tooling today and mixes default/named exports
  (e.g. `glitch-button`). Recommend one; if string-anchor, specify the sentinel
  comments to add to the two TS files.
- **Q4 — Idempotency & safety**: re-running for an existing name must not double-
  insert. Define the guard (mirror the existing generator's `existsSync(docsPath)
  && !options.force`).
- **Q5 — Verification**: the generator should end by running `pnpm registry:build`
  then `pnpm registry:test`, surfacing failures. Confirm this closes the loop.

Write answers into `plans/008-design-notes.md`.

### Step 3: Prototype the safe slice (manifest append only)

Build a minimal script (e.g. `scripts/add-to-manifest.mjs`) that:
- parses `--name --title --description --file --deps --registry-deps --export-name --doc-slug`
  (reuse `generate-docs.mjs`'s `parseArgs`/`joinList` helpers — copy or import),
- refuses if `name` already exists in `registry.components.json` (unless `--force`),
- appends an entry in the established field order,
- writes the JSON back with the same formatting the manifest uses,
- runs no edits to the TS files.

**Verify**: run it for a throwaway name against a copy, then
`pnpm registry:build` and `pnpm registry:test`. **Then revert the throwaway
entry** (the prototype proves feasibility; it must not leave a fake component in
the manifest). Confirm `git diff registry.components.json public/r` is empty
after revert.

### Step 4: Write the design doc

`plans/008-design-notes.md` must contain: the artifact inventory (Step 1),
answered open questions (Step 2), the recommended editing strategy for the two TS
files with concrete sentinel/anchor proposals, a phased build plan (phase 1:
manifest append — prototyped here; phase 2: TS insertion; phase 3: skill
integration), and the risks/edge cases (mixed exports, `EvilButton` alias,
bespoke renders).

## Done criteria

ALL must hold:

- [ ] `plans/008-design-notes.md` exists with the artifact inventory, answers to Q1–Q5, and a phased build plan
- [ ] A manifest-append prototype exists and was demonstrated to round-trip (`registry:build` + `registry:test` pass), then the throwaway entry was reverted
- [ ] `git diff registry.components.json public/r` is empty at the end (no throwaway data left)
- [ ] The TS-editing strategy is recommended with concrete anchors, but NOT implemented
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- Plan 005 has not landed (no `registry.components.json`) — this plan's prototype
  has nothing to append to. Report and wait for 005.
- The TS-editing strategy can't be made safe without adding a codemod dependency
  (`ts-morph` etc.) — flag the dependency decision for the maintainer rather than
  adding it under a design spike.
- The prototype can't produce a byte-identical `pnpm registry:build` output —
  report; the manifest format may need adjusting (coordinate with plan 005).

## Maintenance notes

- This is a design hand-off: phase 2 (TS insertion) and phase 3 (skill
  integration) become their own implementation plans once the strategy is chosen.
- Keep the prototype's CLI flag names aligned with the existing
  `generate-docs.mjs` flags so the two can later merge into one `add-component`.
- Reviewer should evaluate the design doc's Q3 recommendation most closely — the
  TS-editing approach is the project's main remaining risk.
