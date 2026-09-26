/** Sidebar sections for the docs, in display order. */
export const DOCS_CATEGORIES = [
  "Interactive",
  "Mischief",
  "Effects",
  "Styles",
  "Utility",
] as const;

export type DocsCategory = (typeof DOCS_CATEGORIES)[number];

/** Page rendered at `/docs` and highlighted in the sidebar there. */
export const DEFAULT_DOCS_SLUG = "dither-button";
