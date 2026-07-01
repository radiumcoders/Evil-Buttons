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
    <div className="flex flex-col gap-1.5">
      <p className="px-2.5 text-[11px] font-medium tracking-wide text-sidebar-foreground/50">
        {title}
      </p>
      <nav className="flex flex-col gap-px">
        {pages.map((page) => {
          const active =
            isPageActive(pathname, page.url) ||
            (pathname === "/docs" && page.url === defaultPageUrl);

          return (
            <Link
              key={page.url}
              href={page.url}
              aria-current={active ? "page" : undefined}
              className={cn(
                "rounded-md px-2.5 py-1.5 text-[13px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring",
                active
                  ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/65 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground",
              )}
            >
              {page.title}
            </Link>
          );
        })}
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
          "docs-scroll fixed inset-y-0 left-0 z-50 w-64 shrink-0 overflow-y-auto bg-sidebar p-4 text-sidebar-foreground transition-transform duration-200 ease-out md:static md:z-auto md:h-full md:w-52 md:translate-x-0 md:border-r md:border-sidebar-border",
          open ? "translate-x-0" : "-translate-x-full md:translate-x-0",
        )}
      >
        <div className="flex flex-col gap-6">
          <div className="flex items-center justify-between px-0.5">
            {brand}
            <button
              type="button"
              className="inline-flex size-7 items-center justify-center rounded-md text-sidebar-foreground/60 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring md:hidden"
              onClick={() => setOpen(false)}
              aria-label="Close menu"
            >
              <XIcon size={16} />
            </button>
          </div>
          <div className="flex items-center gap-1 px-0.5">
            <a
              href="https://github.com/radiumcoders/evil-buttons"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex size-7 items-center justify-center rounded-md text-sidebar-foreground/50 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              aria-label="GitHub"
            >
              <GithubLogoIcon size={15} />
            </a>
            <a
              href="https://x.com/radiumcoders"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex size-7 items-center justify-center rounded-md text-sidebar-foreground/50 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              aria-label="X (Twitter)"
            >
              <XLogoIcon size={15} />
            </a>
            <a
              href="https://github.com/sponsors/radiumcoders"
              target="_blank"
              rel="noopener noreferrer"
              className="ml-auto inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-sidebar-foreground/50 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            >
              <HeartIcon size={11} weight="fill" className="text-rose-500 dark:text-rose-400" />
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
          className="fixed inset-0 z-40 bg-foreground/15 backdrop-blur-[2px] md:hidden dark:bg-foreground/25"
          onClick={() => setOpen(false)}
          aria-label="Close sidebar"
        />
      ) : null}
      <div className={cn("fixed top-4 left-4 z-50 md:hidden", open && "hidden")}>
        <button
          type="button"
          className="inline-flex size-8 items-center justify-center rounded-md bg-sidebar text-sidebar-foreground/70 shadow-sm ring-1 ring-sidebar-border transition-colors hover:text-sidebar-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
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
