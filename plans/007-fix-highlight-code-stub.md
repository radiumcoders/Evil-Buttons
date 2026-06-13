# Plan 007: Fix or remove the misleading `highlightCode` stub

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat da89f42..HEAD -- lib/highlight-code.ts components/code-block.tsx components/mdx-custom-components.tsx source.config.ts`
> If any changed since this plan was written, compare against the "Current state"
> excerpts before proceeding; on a mismatch, treat it as a STOP condition.

## Status

- **Priority**: P3
- **Effort**: S–M
- **Risk**: LOW
- **Depends on**: none
- **Category**: tech-debt
- **Planned at**: commit `da89f42`, 2026-06-13
- **Confidence**: MED — the stub is real, but `CodeBlock`'s actual usage in docs
  is light; confirm usage in Step 1 before choosing the branch.

## Why this matters

`lib/highlight-code.ts` exports `highlightCode`, which looks like a syntax
highlighter and emits markup with `class="shiki"` — but it ignores the language
entirely and only HTML-escapes the text, producing zero token coloring. The
global CSS even targets `.shiki span { color: var(--shiki-dark) }`, so the
stub's output renders as undefined-variable monochrome text dressed up to look
highlighted. Meanwhile fenced code blocks in MDX are highlighted for real by
`rehype-pretty-code` + `shiki` (configured in `source.config.ts`). The result is
two code-rendering paths with inconsistent output and a function whose name lies
about what it does. This plan makes `CodeBlock` either genuinely highlight (via
the shiki that's already a dependency) or be removed if it's dead.

## Current state

- The stub — note `_language` is unused:

```12:33:lib/highlight-code.ts
export async function highlightCode(
  code: string,
  _language: string,
  options?: { showLineNumbers?: boolean },
) {
  const showLineNumbers = options?.showLineNumbers ?? true;
  const lines = escapeHtml(code).split("\n");

  const rows = lines
    .map((line, index) => {
      if (!showLineNumbers) {
        return `<span data-line><span>${line || " "}</span></span>`;
      }

      return `<span data-line><span class="mr-4 inline-block w-8 select-none text-right text-muted-foreground/60">${
        index + 1
      }</span><span>${line || " "}</span></span>`;
    })
    .join("");

  return `<pre class="shiki"><code>${rows}</code></pre>`;
}
```

- Its only consumer is `CodeBlock`, which injects the result via
  `dangerouslySetInnerHTML`:

```25:28:components/code-block.tsx
  const cleanedCode = stripCodeAnnotations(code);
  const highlightedCode = await highlightCode(cleanedCode, language, {
    showLineNumbers,
  });
```

- `CodeBlock` is registered as an MDX component:

```86:91:components/mdx-custom-components.tsx
export function getCustomMDXComponents(): MDXComponents {
  return {
    PreviewCard,
    Cmd,
    CodeBlock,
```

- Real highlighting already exists for fenced blocks, with these themes:

```22:38:source.config.ts
export default defineConfig({
  mdxOptions: {
    rehypePlugins: (plugins) => {
      plugins.push([
        rehypePrettyCode,
        {
          theme: {
            light: "github-light",
            dark: "vesper",
          },
          defaultColor: false,
        },
      ]);

      return plugins;
    },
  },
});
```

- `shiki@4.x` is already installed (transitively via `rehype-pretty-code`; see
  `pnpm-lock.yaml`), so importing it adds no new top-level dependency cost.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Install | `pnpm install --frozen-lockfile` | exit 0 |
| Find usages | `git grep -n "CodeBlock"` and `git grep -rn "<CodeBlock" content/` | lists usages |
| Typecheck | `pnpm typecheck` | exit 0 (requires plan 002) |
| Lint | `pnpm lint` | exit 0 |
| Build | `pnpm build` | exit 0 |

## Scope

**In scope** (depends on the branch chosen in Step 1):
- `lib/highlight-code.ts`
- possibly `components/code-block.tsx`, `components/mdx-custom-components.tsx`

**Out of scope** (do NOT touch):
- `source.config.ts` and the `rehype-pretty-code` fenced-block path — it already
  works; do not change how `<pre>`/fenced code renders.
- The MDX `pre` override in `components/mdx.tsx` — unrelated to `CodeBlock`.
- `app/globals.css` `.shiki` rules — leave them; real shiki output uses them.

## Git workflow

- Branch: `advisor/007-fix-highlight-code-stub`
- Commit message (Branch A): `fix(code-block): highlight with shiki instead of a no-op stub`
  or (Branch B): `chore: remove unused CodeBlock and highlightCode stub`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Determine whether `CodeBlock` is actually used in docs

Run:
- `git grep -rn "CodeBlock" content/` — any `.mdx` using `<CodeBlock ...>`?
- `git grep -n "CodeBlock" components/ app/` — any non-MDX caller besides the
  registration in `mdx-custom-components.tsx` and the definition?

**Decision:**
- If `CodeBlock` has real usages → **Branch A** (make it highlight for real).
- If the only references are its definition + the MDX registration (i.e. it's
  effectively dead) → **Branch B** (remove it). If unsure, default to Branch A
  (lower-risk for consumers).

### Step 2 — Branch A: Replace the stub with real shiki highlighting

Rewrite `lib/highlight-code.ts` so `highlightCode` uses shiki with the **same
themes** as the fenced path (`github-light` / `vesper`, dual-theme,
`defaultColor: false`) so both code paths look identical. Keep the existing
exported signature `(code, language, options?)` and keep `stripCodeAnnotations`.

```ts
import { codeToHtml } from "shiki";

export function stripCodeAnnotations(code: string) {
  return code.replace(/\/\/\s*\[!code.*\]\s*/g, "");
}

export async function highlightCode(
  code: string,
  language: string,
  options?: { showLineNumbers?: boolean },
) {
  const html = await codeToHtml(code, {
    lang: language || "txt",
    themes: { light: "github-light", dark: "vesper" },
    defaultColor: false,
  });
  // `options.showLineNumbers` is handled via CSS (see app/globals.css line-number
  // rules); if line numbers are required inline, post-process the .line spans.
  return html;
}
```

Notes:
- `codeToHtml` may throw on an unknown `lang`; guard it (fall back to `"txt"`)
  so a doc with an exotic language tag doesn't break the build. Wrap in
  try/catch and on failure call `codeToHtml(code, { lang: "txt", themes: ... })`.
- The output is still injected via `dangerouslySetInnerHTML` in
  `components/code-block.tsx` — that's safe here because input is repo-authored
  doc content and shiki escapes it. Do not change the injection mechanism.
- If `showLineNumbers` must remain functional, confirm the existing
  `app/globals.css` `[data-line]`/line rules apply to shiki's `.line` output, or
  add a small CSS counter; do not reintroduce the manual per-line span builder.

**Verify**: with `pnpm dev`, a docs page that renders a `<CodeBlock>` (or, if
none, a temporary test page) shows colored tokens matching the fenced-block
style in light and dark themes. `pnpm typecheck`, `pnpm lint`, `pnpm build` exit 0.

### Step 2 — Branch B: Remove the dead component and stub

Only if Step 1 proved `CodeBlock` is unused in content:
1. Delete `components/code-block.tsx`.
2. Remove the `CodeBlock` import and its entry from
   `components/mdx-custom-components.tsx`.
3. Delete `lib/highlight-code.ts` **only if** `stripCodeAnnotations` has no other
   consumers (`git grep -n "stripCodeAnnotations"`). If it's used elsewhere, keep
   the file but delete the `highlightCode` export.

**Verify**: `git grep -n "highlightCode"` and `git grep -n "CodeBlock"` return no
dangling references; `pnpm typecheck`, `pnpm lint`, `pnpm build` exit 0;
`pnpm registry:test` still passes.

### Step 3: Final verification

**Verify**: `pnpm build` exits 0 and the docs site renders code blocks correctly
(fenced blocks unchanged; `CodeBlock` either highlights or is gone).

## Test plan

No unit harness for rendering. Verification is visual (Branch A: tokens are
colored and match fenced blocks in both themes) plus typecheck/lint/build and
`registry:test`. If Branch A is taken, manually verify at least one `tsx` and one
`bash` snippet highlight correctly.

## Done criteria

ALL must hold:

- [ ] Step 1 documented whether `CodeBlock` is used, and which branch was taken
- [ ] Branch A: `highlightCode` produces real shiki output with `github-light`/`vesper`; OR Branch B: `CodeBlock` + `highlightCode` removed with no dangling references
- [ ] `git grep -n "highlightCode"` shows no caller of a stub (it either highlights or is gone)
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm build` exit 0
- [ ] `pnpm registry:test` passes
- [ ] Fenced-block highlighting (rehype-pretty-code path) is unchanged
- [ ] `plans/README.md` status row updated

## STOP conditions

Stop and report back (do not improvise) if:

- Branch A: shiki's bundle/runtime cost in the client path is prohibitive (e.g.
  `CodeBlock` is a client component and importing `shiki` bloats the client
  bundle) — report; the fix may need a server-only boundary.
- `stripCodeAnnotations` turns out to be used by the fenced path too — re-scope
  before deleting anything.
- Removing `CodeBlock` (Branch B) breaks a build because a doc DOES use it —
  switch to Branch A instead and note it.

## Maintenance notes

- Keeping `highlightCode`'s themes in sync with `source.config.ts` matters: if
  the fenced-block themes change, update both. Consider a shared constant in a
  follow-up.
- Reviewer should confirm the two code paths now look identical (Branch A) or
  that nothing references the removed symbols (Branch B).
