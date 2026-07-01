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
  children: ReactNode;
  componentPages: DocsNavPage[];
};

export function DocsShell({
  children,
  componentPages,
}: DocsShellProps) {
  return (
    <div className="flex h-dvh overflow-hidden bg-background text-foreground">
      <ThemeSync />
      <DocsSidebar
        componentPages={componentPages}
        brand={
          <Link
            href="/"
            className="flex items-center gap-2 text-sidebar-foreground transition-opacity hover:opacity-80"
          >
            <Image
              src="/logo.png"
              alt="EvilButtons"
              width={288}
              height={192}
              className="h-auto w-7"
            />
            <span className="font-doto text-sm font-black tracking-tighter">
              EvilButtons
            </span>
          </Link>
        }
      />
      <main className="docs-scroll min-w-0 flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
