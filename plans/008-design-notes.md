# Design notes: a single `add-component` generator

Deliverable of plan 008 (design/spike). Written against commit `da89f42` +
plans 004/005 (the shared `registry.components.json` manifest now exists).

## 1. Artifact inventory — what adding a component touches

| # | Artifact | Insertion point | Today | Phase |
|---|----------|-----------------|-------|-------|
| 1 | `components/evil-buttons/<name>.tsx` | new file | hand-written | out of scope (author writes the component) |
| 2 | `registry.components.json` | append one entry | manual | **phase 1 — prototyped** (`scripts/add-to-manifest.mjs`) |
| 3 | `content/docs/<docSlug>.mdx` | new file | `evil-button-docs/scripts/generate-docs.mjs` | already automated |
| 4 | `components/mdx-custom-components.tsx` | import line + key in `getCustomMDXComponents()` return object | manual | phase 2 (TS insertion) |
| 5 | `components/landing/landing-page.tsx` | import line + entry in `showcase[]` (with bespoke `render()`) | manual | phase 2 (TS insertion) |

Coverage of #2/#3/#4/#5 is now *enforced* by `scripts/test-registry.mjs` (plan
005), so a forgotten registration fails CI rather than shipping broken.

## 2. Open questions — answered

**Q1 — Manifest append (formatting).** The manifest is plain JSON, so appending
+ `pnpm registry:build` reproduces the registry output deterministically (the
build reads only `name/title/description/file/dependencies/registryDependencies`).
Caveat surfaced by the prototype: `JSON.stringify(manifest, null, 2)` writes
array elements **multi-line**, whereas the committed manifest currently uses
inline arrays (e.g. `"dependencies": ["motion", "clsx"]`). To make the generator
round-trip with an empty diff, **normalize `registry.components.json` once to the
`JSON.stringify(_, null, 2)` shape** and treat that as canonical (recommended),
rather than teaching the generator a bespoke formatter. This normalization is a
one-line follow-up (`node -e` re-stringify) and is intentionally NOT done here to
avoid churn before the maintainer decides.

**Q2 — Landing `render()`.** The `showcase` entries carry bespoke props
(`CommandButton shortcut="mod+s"`, `CopyButton value="…"`, `RevealButton
label="…"`, the two WebGL buttons now wrapped in `DeferredMount`). Encoding all
of that in the manifest is not worth it. **Recommendation: emit a generic
`render: () => <ExportName>Label</ExportName>` that the author edits**, with the
label defaulting to the title. The generator should insert a clearly-marked
TODO comment so the author knows to customize props.

**Q3 — TS file editing strategy.** Two options:
- *String-anchor insertion* (find a sentinel comment, insert before it). No new
  deps; trivial to implement. Fragile to formatting drift, but the two target
  files are small and append-friendly.
- *AST codemod* (`ts-morph`/compiler API). Robust to formatting and handles the
  mixed default/named export styles cleanly, but adds a dev dependency the repo
  doesn't have today.

**Recommendation: string-anchor insertion**, given the repo has no codemod
tooling and the inserts are simple. Add two sentinel comments:
- in `components/mdx-custom-components.tsx`: a `// @generated:imports` marker
  above the button imports and a `// @generated:registrations` marker inside the
  returned object; the generator inserts an import and a `ExportName,` key.
- in `components/landing/landing-page.tsx`: a `// @generated:imports` marker and
  a `// @generated:showcase` marker before the closing `]` of `showcase`.
Mixed default/named exports are handled by adding an `export: "default" |
"named"` field to the manifest entry (the existing docs generator already has an
`--export` flag with the same semantics) so the generator emits the right import
form. Note the existing `glitch-button` inconsistency (default in landing, named
in MDX) — the generator would standardize new components, and that legacy case
can be reconciled separately.

**Q4 — Idempotency & safety.** Mirror `generate-docs.mjs`'s guard: refuse when
the name already exists unless `--force`. The prototype implements this
(`registry.components.json already has an entry named "…"`, exit 1). Phase 2 must
also detect an existing import/registration line before inserting (search for the
`ExportName` token) to avoid double-insertion.

**Q5 — Verification (closing the loop).** The generator should end by running
`pnpm registry:build` then `pnpm registry:test`. The prototype does this when it
actually writes (via `execSync`). `registry:test` then fails loudly if the
component file (#1) or docs (#3) are missing — which is the desired behavior: it
tells the author exactly what's left to do.

## 3. Prototype (phase 1) — what was built and proven

`scripts/add-to-manifest.mjs`:
- Flags: `--name --export-name --doc-slug --title --description --file --deps
  --registry-deps --dry-run --force` (flag names aligned with
  `generate-docs.mjs` so the two can later merge into one `add-component`).
- Builds the entry in the exact key order used by `build-registry.mjs`'s
  `buildItem` (`name, exportName, docSlug, title, description, file,
  [registryDependencies], dependencies`).
- `--dry-run` prints the entry and writes nothing.
- Refuses an existing name unless `--force` (Q4).
- On a real write: appends, then runs `pnpm registry:build` + `pnpm
  registry:test` (Q5).

Demonstrated (no junk left in the manifest):
- `--dry-run` emitted a correctly-ordered `demo-button` entry.
- The dedup guard exited 1 for an existing name (`hold-button`).
- `git diff registry.components.json` was empty afterward.

A *full* round-trip (append a real entry, build, test, all green) is deliberately
not demonstrated here because it requires an accompanying component `.tsx` (#1)
and docs (#3) — which is exactly why phases 2/3 fold this into the component +
docs generators rather than shipping manifest-only.

## 4. Phased build plan

- **Phase 1 (done as prototype)**: manifest append with dedup guard + verify.
  Before promoting it, normalize the manifest formatting (Q1) and add an
  `export` field per entry (Q3).
- **Phase 2**: string-anchor insertion into `mdx-custom-components.tsx` and
  `landing-page.tsx` (add sentinels, idempotent inserts, generic `render()`),
  plus generating a component `.tsx` stub. Becomes its own implementation plan.
- **Phase 3**: merge with `evil-button-docs/scripts/generate-docs.mjs` into a
  single `add-component` command (manifest + docs + TS registrations + component
  stub), wired into the skill. Its own plan.

## 5. Risks & edge cases

- **Manifest formatting drift** (Q1) — biggest round-trip risk; fix by
  normalizing the canonical format.
- **Mixed default/named exports** — the `glitch-button` legacy mismatch; new
  components standardized via the `export` field.
- **`EvilButton: ClickPowerUp` alias** in the MDX map — a non-1:1 registration
  the generator must not clobber; the sentinel-based insert appends and leaves
  existing keys (including aliases) untouched.
- **Bespoke landing `render()`** — generic output requires manual prop editing;
  flagged with a TODO comment, not silently shipped.
