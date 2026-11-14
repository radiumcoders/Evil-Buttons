/**
 * Evil Buttons ships twice: the React/shadcn registry at evilbuttons.com and
 * the Rust/GPUI crate at gpui.evilbuttons.com. Both docs sites use the same
 * slugs, so a page here links straight to the same button over there.
 */
export const counterpart = {
  /** This site's framework. */
  here: "React" as "React" | "GPUI",
  /** The other site's framework. */
  name: "GPUI",
  note: "Rust",
  url: "https://gpui.evilbuttons.com",
} as const;

/** Buttons that only exist on this site (no page on the other one yet). */
const ONLY_HERE = new Set<string>(["stretchy-button"]);

/** The other site's page for `pathname`, falling back to its docs index. */
export function counterpartUrl(pathname: string): string {
  const slug = pathname.match(/^\/docs\/([^/]+)\/?$/)?.[1];
  const path = slug && !ONLY_HERE.has(slug) ? `/docs/${slug}` : "/docs";
  return `${counterpart.url}${path}`;
}
