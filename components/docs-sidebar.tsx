"use client";

import {
  GithubLogoIcon,
  HeartIcon,
  ListIcon,
  XIcon,
  XLogoIcon,
} from "@phosphor-icons/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

type DocsNavPage = {
  title: string;
  url: string;
};

type DocsSidebarProps = {
  introductionPages: DocsNavPage[];
  componentPages: DocsNavPage[];
  brand: ReactNode;
};

function isPageActive(pathname: string, url: string) {
  return (
    pathname === url || (pathname === "/docs" && url === "/docs/introduction")
  );
}

function DocsNavGroup({
  title,
  pages,
}: {
  title: string;
  pages: DocsNavPage[];
}) {
  const pathname = usePathname();

  if (pages.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-1 border-t border-border pt-4">
      <p className="px-2 text-xs font-semibold text-muted-foreground">
        {title}
      </p>
      <nav className="flex flex-col gap-0.5">
        {pages.map((page) => (
          <Link
            key={page.url}
            href={page.url}
            aria-current={isPageActive(pathname, page.url) ? "page" : undefined}
            className={cn(
              "block rounded px-2 py-1.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              isPageActive(pathname, page.url)
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {page.title}
          </Link>
        ))}
      </nav>
    </div>
  );
}

export function DocsSidebar({
  introductionPages,
  componentPages,
  brand,
}: DocsSidebarProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const rafId = window.requestAnimationFrame(() => {
      setOpen(false);
    });

    return () => window.cancelAnimationFrame(rafId);
  }, [pathname]);

  return (
    <>
      <aside
        className={cn(
          "fixed inset-y-2 left-2 z-20 w-64 shrink-0 overflow-y-auto rounded border border-border bg-background p-2 shadow-xl transition-transform duration-200 ease-out md:static md:inset-auto md:z-auto md:h-full md:translate-x-0 md:border-0 md:bg-transparent md:p-0 md:pr-2 md:shadow-none",
          open ? "translate-x-0" : "translate-x-[-110%] md:translate-x-0",
        )}
      >
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between px-2 pt-1">
            {brand}
            <button
              type="button"
              className="inline-flex size-8 items-center justify-center rounded-md border border-border bg-background text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:hidden"
              onClick={() => setOpen(false)}
              aria-label="Close menu"
            >
              <XIcon size={16} />
            </button>
          </div>
          <div className="flex items-center gap-1.5 px-2">
            <a
              href="https://github.com/radiumcoders/evil-buttons"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors border-border border hover:bg-muted hover:text-foreground"
              aria-label="GitHub"
            >
              <GithubLogoIcon size={15} />
            </a>
            <a
              href="https://x.com/radiumcoders"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground border-border border transition-colors hover:bg-muted hover:text-foreground"
              aria-label="X (Twitter)"
            >
              <XLogoIcon size={15} />
            </a>
            <a
              href="https://github.com/sponsors/radiumcoders"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-md border-border border px-3 py-1.5 text-xs font-medium text-pink-600 transition-colors hover:bg-pink-100 dark:text-pink-400 dark:hover:bg-pink-950/50 duration-75"
            >
              <HeartIcon size={12} />
              Sponsor
            </a>
          </div>
          <DocsNavGroup title="Introduction" pages={introductionPages} />
          <DocsNavGroup title="Components" pages={componentPages} />
        </div>
      </aside>
      {open ? (
        <button
          type="button"
          className="fixed inset-0 z-10 bg-black/30 md:hidden"
          onClick={() => setOpen(false)}
          aria-label="Close sidebar"
        />
      ) : null}
      <div
        className={cn("fixed top-4 left-4 z-30 md:hidden", open && "hidden")}
      >
        <button
          type="button"
          className="inline-flex size-8 items-center justify-center rounded border border-border bg-background text-muted-foreground shadow-sm transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-label="Open menu"
        >
          <ListIcon size={16} />
        </button>
      </div>
    </>
  );
}
