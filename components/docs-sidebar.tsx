"use client";

import {
  GithubLogoIcon,
  HeartIcon,
  ListIcon,
  XLogoIcon,
} from "@phosphor-icons/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
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

function DocsNavLinks({
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
      <div className="flex flex-col gap-px">
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
      </div>
    </div>
  );
}

function DocsSidebarChrome({
  brand,
  children,
}: {
  brand: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between px-0.5">{brand}</div>
      <div className="flex items-center gap-1 px-0.5">
        <a
          href="https://github.com/radiumcoders/evil-buttons"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex size-8 items-center justify-center rounded-md text-sidebar-foreground/50 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
          aria-label="GitHub"
        >
          <GithubLogoIcon size={15} />
        </a>
        <a
          href="https://x.com/radiumcoders"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex size-8 items-center justify-center rounded-md text-sidebar-foreground/50 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
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
          <HeartIcon
            size={11}
            weight="fill"
            className="text-rose-500 dark:text-rose-400"
          />
          Sponsor
        </a>
      </div>
      {children}
    </div>
  );
}

export function DocsSidebar({ componentPages, brand }: DocsSidebarProps) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const defaultPageUrl = componentPages[0]?.url;

  useEffect(() => {
    const rafId = window.requestAnimationFrame(() => {
      setOpen(false);
    });

    return () => window.cancelAnimationFrame(rafId);
  }, [pathname]);

  const nav = (
    <nav aria-label="Docs">
      <DocsNavLinks
        title="Buttons"
        pages={componentPages}
        defaultPageUrl={defaultPageUrl}
      />
    </nav>
  );

  return (
    <>
      <aside className="docs-scroll hidden h-full w-52 shrink-0 overflow-y-auto border-r border-sidebar-border bg-sidebar p-4 text-sidebar-foreground md:block">
        <DocsSidebarChrome brand={brand}>{nav}</DocsSidebarChrome>
      </aside>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="fixed top-4 left-4 z-50 bg-sidebar text-sidebar-foreground/70 shadow-sm md:hidden"
            aria-label="Open menu"
          >
            <ListIcon size={16} />
          </Button>
        </SheetTrigger>
        <SheetContent
          side="left"
          className="docs-scroll w-64 border-sidebar-border bg-sidebar p-4 text-sidebar-foreground"
          showCloseButton
        >
          <SheetTitle className="sr-only">Docs</SheetTitle>
          <DocsSidebarChrome brand={brand}>{nav}</DocsSidebarChrome>
        </SheetContent>
      </Sheet>
    </>
  );
}
