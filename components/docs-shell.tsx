import Link from "next/link";
import type { ReactNode } from "react";
import { DocsSidebar } from "@/components/docs-sidebar";
import { ThemeSync } from "@/components/theme-sync";

type DocsNavPage = {
  title: string;
  url: string;
};

type DocsShellProps = {
  introductionPages: DocsNavPage[];
  componentPages: DocsNavPage[];
  children: ReactNode;
};

export function DocsShell({ introductionPages, componentPages, children }: DocsShellProps) {
  return (
    <div className="flex h-dvh overflow-hidden bg-neutral-50 p-2 dark:bg-neutral-900">
      <ThemeSync />
      <DocsSidebar
        introductionPages={introductionPages}
        componentPages={componentPages}
        brand={
          <Link
            href="/docs"
            className="text-sm font-semibold tracking-tight text-foreground transition-colors hover:text-muted-foreground"
          >
            EvilButtons
          </Link>
        }
      />
      <div className="min-w-0 flex-1 overflow-hidden rounded border border-border bg-background text-foreground">
        <div className="h-full min-w-0 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}
