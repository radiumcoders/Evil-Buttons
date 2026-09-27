# Contributing to Evil Buttons

Thanks for helping make Evil Buttons better. Every new button should feel polished, install cleanly from the registry, and work across themes, screens, and input methods.

## New Button Requirements

Every new button must include:

- **Dark mode support:** The button must look intentional in both light and dark mode. Use `dark:` classes, CSS variables, or theme-aware colors instead of hard-coded light-only styles.
- **Responsive behavior:** The button must hold up on mobile and desktop. Text should not overflow, controls should not shift unexpectedly, and sizing should work with short and moderately long labels.
- **Accessible HTML:** Prefer a real `<button>` unless the component is explicitly link-based. Forward standard button props where reasonable, preserve focus states, and keep labels readable.
- **Motion safety:** Hover, press, and animation states should respect `motion-reduce` when animation is significant.
- **Documentation:** Add a matching MDX page in `content/docs/` with preview, install command, usage example, props table, notes, and registry details.
- **Registry support:** Add an entry to `registry.components.json` so `pnpm registry:build` generates its `public/r/<name>.json` file and updates `public/r/index.json`. Also register it in `components/mdx-custom-components.tsx` and the landing showcase (`components/landing/showcase.ts` plus a preview in `components/landing/previews/`); `pnpm registry:test` checks all of these.
- **Dependencies declared:** Any runtime dependency must be listed in the registry item. Registry dependencies should be listed separately from npm dependencies.
- **Consistent imports:** Use the project alias and helpers already used in the repo, especially `cn` from `@/lib/utils` when composing classes.

## Component Checklist

Before opening a PR or merging a button, verify:

- The component lives in `components/evil-buttons/`.
- The component exports the public API shown in its docs.
- Light and dark themes both have readable contrast and complete hover, focus, and active states.
- The button works with custom `className` and does not require fixed page backgrounds to look correct.
- Layout stays stable with different labels, icon-only usage if supported, and small viewport widths.
- All forwarded props still work, including `disabled`, `type`, `onClick`, and `aria-*` attributes when applicable.
- No unrelated files or generated churn are included in the change.

## Documentation Checklist

Each docs page should include:

- Frontmatter `title` and `description`.
- A short explanation of what the button does.
- A preview using `<PreviewCard>`.
- An install command using `<Cmd>@evilbuttons/<registry-name></Cmd>`.
- A copy-ready usage example.
- A props table with defaults and clear descriptions.
- Notes for theme behavior, sizing, animation, or important implementation details.
- A registry section that names included files and dependencies.

## Verification

Run these checks before handing off:

```bash
pnpm registry:build
pnpm registry:test
pnpm lint
pnpm typecheck
pnpm build
```

CI runs the same checks on every pull request.

If a command fails because of an existing unrelated issue, mention the exact file and error in your handoff. If `next build` needs network access for Google Fonts, rerun it in an environment where font fetching is available.

## Style Guidance

Keep buttons focused and reusable. Avoid one-off page assumptions, invisible focus states, hard-coded theme colors that break in dark mode, and oversized effects that make the button hard to use. A button can be weird, dramatic, or playful, but it should still be dependable.
