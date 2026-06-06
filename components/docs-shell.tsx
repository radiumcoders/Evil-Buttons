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
            className="flex items-center justify-center gap-2"
          >
            <Image
              src="/logo.png"
              alt="EvilButtons"
              width={288}
              height={192}
              className="h-auto w-8 sm:w-10"
            />
            <h1 className="text-lg font-doto font-black tracking-tighter">
              EvilButtons
            </h1>
          </Link>
        }
      />
      <main className="min-w-0 flex-1 m-1 border border-border overflow-y-auto">{children}</main>
    </div>
  );
}
