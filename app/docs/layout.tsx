import type { ReactNode } from "react";
import { DocsShell } from "@/components/docs-shell";
import { source } from "@/lib/source";

export default function DocsLayout({ children }: { children: ReactNode }) {
  const pages = source.getPages().map((page) => ({
    title: page.data.title ?? page.slugs.at(-1) ?? "Untitled",
    url: page.url,
  }));

  return (
    <DocsShell pages={pages}>{children}</DocsShell>
  );
}
