import type { ReactNode } from "react";
import { DocsShell } from "@/components/docs-shell";
import { DOCS_CATEGORIES } from "@/lib/docs-categories";
import { source } from "@/lib/source";

const UNCATEGORIZED = "Other";

export default function DocsLayout({ children }: { children: ReactNode }) {
  const pages = source
    .getPages()
    .map((page) => ({
      title: page.data.title ?? page.slugs.at(-1) ?? "Untitled",
      url: page.url,
      category: page.data.category ?? UNCATEGORIZED,
    }))
    .sort((a, b) => a.title.localeCompare(b.title));

  const sections = [...DOCS_CATEGORIES, UNCATEGORIZED]
    .map((category) => ({
      title: category,
      pages: pages.filter((page) => page.category === category),
    }))
    .filter((section) => section.pages.length > 0);

  return (
    <DocsShell componentPages={pages} sections={sections}>
      {children}
    </DocsShell>
  );
}
