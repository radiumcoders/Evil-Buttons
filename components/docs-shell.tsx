import Link from "next/link";
import Image from "next/image";
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
  logoPages: DocsNavPage[];
  children: ReactNode;
};

export function DocsShell({
  introductionPages,
  componentPages,
  logoPages,
  children,
}: DocsShellProps) {
  return (
    <div className="flex h-dvh overflow-hidden bg-neutral-50 p-2 dark:bg-neutral-900">
      <ThemeSync />
      <DocsSidebar
        introductionPages={introductionPages}
        componentPages={componentPages}
        logoPages={logoPages}
        brand={
          <Link
            href="/docs"
            className="group flex items-center gap-2 text-lg font-bold tracking-tight text-foreground transition-colors hover:text-muted-foreground"
          >
            <Image
              src="/logo.svg"
              alt="EvilButtons"
              width={24}
              height={24}
              className="dark:invert"
              style={{ width: "auto", height: "auto" }}
            />
            <span>EvilButtons</span>
          </Link>
        }
      />
      <div className="min-w-0 flex-1 overflow-hidden rounded border border-border bg-background text-foreground">
        <div className="h-full min-w-0 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}
