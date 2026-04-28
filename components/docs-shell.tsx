"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { PageToc } from "@/components/page-toc";

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
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  function isPageActive(url: string) {
    return pathname === url || (pathname === "/docs" && url === "/docs/introduction");
  }

  useEffect(() => {
    const stored = localStorage.getItem("theme");
    const prefersDark = window.matchMedia(
      "(prefers-color-scheme: dark)",
    ).matches;
    const dark = stored ? stored === "dark" : prefersDark;
    document.documentElement.classList.toggle("dark", dark);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== "d") return;
      if ((event.target as HTMLElement | null)?.closest("input, textarea"))
        return;

      event.preventDefault();
      const next = !document.documentElement.classList.contains("dark");
      document.documentElement.classList.toggle("dark", next);
      localStorage.setItem("theme", next ? "dark" : "light");
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    const rafId = window.requestAnimationFrame(() => {
      setOpen(false);
    });
    return () => window.cancelAnimationFrame(rafId);
  }, [pathname]);

  return (
    <div className="flex h-dvh overflow-hidden bg-neutral-50 p-2 dark:bg-neutral-900">
      <aside
        className={cn(
          "fixed inset-y-2 left-2 z-20 w-64 shrink-0 overflow-y-auto rounded border border-border bg-background p-2 transition-transform md:static md:inset-auto md:z-auto md:h-full md:translate-x-0 md:border-0 md:bg-transparent md:p-0 md:pr-2",
          open ? "translate-x-0" : "translate-x-[-110%] md:translate-x-0",
        )}
      >
        <div className="space-y-4">
          <div className="px-2">
            <Link
              href="/docs"
              className="text-sm font-semibold tracking-tight text-foreground transition-colors hover:text-muted-foreground"
            >
              EvilButtons
            </Link>
          </div>
          {introductionPages.length > 0 ? (
            <div className="border-t border-border pt-4">
              <p className="px-2 text-xs font-semibold text-muted-foreground">Introduction</p>
              <nav className="mt-1 space-y-0.5">
                {introductionPages.map((page) => (
                  <Link
                    key={page.url}
                    href={page.url}
                    className={cn(
                      "block rounded px-2 py-1.5 text-sm transition-colors",
                      isPageActive(page.url)
                        ? "bg-muted text-foreground"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {page.title}
                  </Link>
                ))}
              </nav>
            </div>
          ) : null}
          {componentPages.length > 0 ? (
            <div className="border-t border-border pt-4">
              <p className="px-2 text-xs font-semibold text-muted-foreground">Components</p>
              <nav className="mt-1 space-y-0.5">
                {componentPages.map((page) => (
                  <Link
                    key={page.url}
                    href={page.url}
                    className={cn(
                      "block rounded px-2 py-1.5 text-sm transition-colors",
                      isPageActive(page.url)
                        ? "bg-muted text-foreground"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {page.title}
                  </Link>
                ))}
              </nav>
            </div>
          ) : null}
        </div>
      </aside>
      {open && (
        <button
          type="button"
          className="fixed inset-0 z-10 bg-black/30 md:hidden"
          onClick={() => setOpen(false)}
          aria-label="Close sidebar"
        />
      )}
      <div className="min-w-0 flex-1 overflow-hidden bg-background text-foreground">
        <div className="mx-auto flex h-full w-full flex-col overflow-hidden rounded border border-border">
          <div className="sticky top-0 z-10 border-b border-border bg-background px-3 py-2 md:hidden">
            <button
              type="button"
              className="rounded border border-border px-2 py-1 text-sm text-muted-foreground"
              onClick={() => setOpen((value) => !value)}
            >
              {open ? "Close menu" : "Open menu"}
            </button>
          </div>
          <div className="min-w-0 flex-1 overflow-y-auto">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
