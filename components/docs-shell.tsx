import Link from "next/link";
import Image from "next/image";
import type { ReactNode } from "react";
import { DocsCommandMenu } from "@/components/docs-command-menu";
import { DocsSidebar } from "@/components/docs-sidebar";
import { DEFAULT_DOCS_SLUG } from "@/lib/docs-categories";

type DocsNavPage = {
  title: string;
  url: string;
};

type DocsNavSection = {
  title: string;
  pages: DocsNavPage[];
};

type DocsShellProps = {
  children: ReactNode;
  componentPages: DocsNavPage[];
  sections: DocsNavSection[];
};

export function DocsShell({
  children,
  componentPages,
  sections,
}: DocsShellProps) {
  return (
    <div
      data-docs-scroll
      className="docs-scroll h-dvh overflow-y-auto bg-background text-foreground md:bg-chrome"
    >
      <div className="mx-auto flex w-full max-w-[1440px] md:gap-4 md:px-3 lg:gap-6">
        <DocsSidebar
          sections={sections}
          defaultPageUrl={`/docs/${DEFAULT_DOCS_SLUG}`}
          brand={
            <Link
              href="/"
              className="flex items-center gap-2 rounded-md text-sidebar-foreground transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
            >
              <Image
                src="/logo.png"
                alt="EvilButtons"
                width={288}
                height={192}
                className="h-auto w-7"
              />
              <span className="text-[15px] font-semibold tracking-tight">
                EvilButtons
              </span>
            </Link>
          }
        />
        <main className="min-w-0 flex-1">{children}</main>
      </div>
      <DocsCommandMenu pages={componentPages} />
    </div>
  );
}
