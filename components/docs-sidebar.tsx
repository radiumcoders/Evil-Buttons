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
  componentPages: DocsNavPage[];
  brand: ReactNode;
};

function isPageActive(pathname: string, url: string) {
  return pathname === url;
}

function DocsNavGroup({
  title,
  pages,
  defaultPageUrl,
}: {
  title: string;
  pages: DocsNavPage[];
  defaultPageUrl?: string;
}) {
  const pathname = usePathname();

  if (pages.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-1 border-t border-border pt-4">
      <p className="px-2 text-xs uppercase text-muted-foreground">{title}</p>
      <nav className="flex flex-col gap-0.5">
        {pages.map((page) => (
          <Link
            key={page.url}
            href={page.url}
            aria-current={
              isPageActive(pathname, page.url) ||
              (pathname === "/docs" && page.url === defaultPageUrl)
                ? "page"
                : undefined
            }
            className={cn(
              "block px-2 py-1.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              isPageActive(pathname, page.url) ||
                (pathname === "/docs" && page.url === defaultPageUrl)
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
  componentPages,
  brand,
}: DocsSidebarProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const defaultPageUrl = componentPages[0]?.url;

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
          "docs-sidebar-scroll fixed inset-y-0 left-0 z-50 w-64 shrink-0 overflow-y-auto border-r border-border bg-background p-3 transition-transform duration-200 ease-out md:static md:z-auto md:h-full md:w-56 md:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full md:translate-x-0",
        )}
      >
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between px-2 pt-1">
            {brand}
            <button
              type="button"
              className="inline-flex size-8 items-center justify-center border border-border bg-background text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:hidden"
              onClick={() => setOpen(false)}
              aria-label="Close menu"
            >
              <XIcon size={16} />
            </button>
          </div>
          <div className="flex items-center gap-2 px-1">
            <a
              href="https://github.com/radiumcoders/evil-buttons"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex size-8 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
              aria-label="GitHub"
            >
              <GithubLogoIcon size={16} />
            </a>
            <a
              href="https://x.com/radiumcoders"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex size-8 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
              aria-label="X (Twitter)"
            >
              <XLogoIcon size={16} />
            </a>
            <a
              href="https://github.com/sponsors/radiumcoders"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-2 py-1 text-xs font-medium text-pink-600 transition-colors hover:text-foreground dark:text-pink-400"
            >
              <HeartIcon size={12} />
              Sponsor
            </a>
          </div>
          <DocsNavGroup
            title="Buttons"
            pages={componentPages}
            defaultPageUrl={defaultPageUrl}
          />
        </div>
      </aside>
      {open ? (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/30 md:hidden"
          onClick={() => setOpen(false)}
          aria-label="Close sidebar"
        />
      ) : null}
      <div className={cn("fixed top-4 left-4 z-50 md:hidden", open && "hidden")}>
        <button
          type="button"
          className="inline-flex size-8 items-center justify-center border border-border bg-background text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
