import type { ReactNode } from "react";
import { DocsShell } from "@/components/docs-shell";
import { source } from "@/lib/source";

const INTRODUCTION_PAGE_URLS = ["/docs/introduction", "/docs/quick-start"];
const INTRODUCTION_PAGE_URL_SET = new Set(INTRODUCTION_PAGE_URLS);

export default function DocsLayout({ children }: { children: ReactNode }) {
  const pages = source.getPages().map((page) => ({
    title: page.data.title ?? page.slugs.at(-1) ?? "Untitled",
    url: page.url,
  }));
  const introductionPages = pages.filter((page) => INTRODUCTION_PAGE_URL_SET.has(page.url));
  const componentPages = pages
    .filter((page) => !INTRODUCTION_PAGE_URL_SET.has(page.url))
    .sort((a, b) => a.title.localeCompare(b.title));

  return (
    <DocsShell introductionPages={introductionPages} componentPages={componentPages}>
      {children}
    </DocsShell>
  );
}
