"use client";

import {
  GithubLogoIcon,
  HeartIcon,
  ListIcon,
  XLogoIcon,
} from "@phosphor-icons/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { EggHuntButton } from "@/components/easter-eggs/egg-hunt";

type DocsNavPage = {
  title: string;
  url: string;
};

type DocsNavSection = {
  title: string;
  pages: DocsNavPage[];
};

type DocsSidebarProps = {
  sections: DocsNavSection[];
  defaultPageUrl?: string;
  brand: ReactNode;
};

function DocsNav({
  sections,
  defaultPageUrl,
}: {
  sections: DocsNavSection[];
  defaultPageUrl?: string;
}) {
  const pathname = usePathname();
  const navRef = useRef<HTMLElement>(null);
  const dotRef = useRef<HTMLSpanElement>(null);
  const swingRef = useRef<HTMLSpanElement>(null);
  const lastY = useRef<number | null>(null);

  const activeUrl =
    pathname === "/docs" ? (defaultPageUrl ?? pathname) : pathname;

  // Pins the dot beside the active link. The first placement (and any
  // re-measure after fonts or layout settle) is instant; route changes glide
  // in y while the inner span swings out in x, tracing an arc.
  useLayoutEffect(() => {
    const nav = navRef.current;
    const dot = dotRef.current;
    const swing = swingRef.current;
    if (!nav || !dot || !swing) return;

    const place = (animateMove: boolean) => {
      const link = nav.querySelector<HTMLElement>('[aria-current="page"]');
      if (!link) {
        dot.style.opacity = "0";
        lastY.current = null;
        return;
      }

      const y = link.offsetTop + link.offsetHeight / 2;
      const moved = lastY.current !== null && lastY.current !== y;
      dot.dataset.animate = animateMove && moved ? "true" : "false";
      dot.style.transform = `translateY(${y}px)`;
      dot.style.opacity = "1";

      if (animateMove && moved) {
        swing.classList.remove("docs-dot-swing");
        void swing.offsetWidth;
        swing.classList.add("docs-dot-swing");
      }
      lastY.current = y;
    };

    place(true);

    const observer = new ResizeObserver(() => place(false));
    observer.observe(nav);
    return () => observer.disconnect();
  }, [activeUrl]);

  return (
    <nav ref={navRef} aria-label="Docs" className="relative flex flex-col gap-6">
      <span
        ref={dotRef}
        aria-hidden
        data-animate="false"
        className="pointer-events-none absolute top-0 left-3 opacity-0 data-[animate=true]:transition-transform data-[animate=true]:duration-500 data-[animate=true]:ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none!"
      >
        <span
          ref={swingRef}
          className="-mt-[3px] block size-1.5 rounded-full bg-brand shadow-[0_0_6px_var(--brand)]"
        />
      </span>
      {sections.map((section) => (
        <div key={section.title} className="flex flex-col gap-1.5">
          <p className="px-3 font-mono text-[11px] font-medium tracking-[0.14em] text-muted-foreground/70 uppercase">
            {section.title}
          </p>
          <ul className="flex flex-col">
            {section.pages.map((page) => {
              const active = page.url === activeUrl;

              return (
                <li key={page.url}>
                  <Link
                    href={page.url}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "block truncate rounded-md py-1.5 pr-3 text-sm transition-[padding,color] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-reduce:transition-none",
                      active
                        ? "pl-7 font-medium text-foreground"
                        : "pl-3 text-muted-foreground hover:pl-4 hover:text-foreground",
                    )}
                  >
                    {page.title}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

const iconLinkClass =
  "inline-flex size-8 items-center justify-center rounded-md text-sidebar-foreground/50 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring";

function DocsSidebarChrome({
  brand,
  children,
}: {
  brand: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-14 shrink-0 items-center px-4">{brand}</div>
      <div className="docs-scroll min-h-0 flex-1 overflow-y-auto px-2 py-2 [mask-image:linear-gradient(to_bottom,transparent,black_12px,black_calc(100%-16px),transparent)]">
        {children}
      </div>
      <div className="flex items-center gap-0.5 border-t border-border p-2">
        <a
          href="https://github.com/radiumcoders/evil-buttons"
          target="_blank"
          rel="noopener noreferrer"
          className={iconLinkClass}
          aria-label="GitHub"
        >
          <GithubLogoIcon size={15} />
        </a>
        <a
          href="https://x.com/radiumcoders"
          target="_blank"
          rel="noopener noreferrer"
          className={iconLinkClass}
          aria-label="X (Twitter)"
        >
          <XLogoIcon size={15} />
        </a>
        <EggHuntButton className="ml-1 text-sidebar-foreground/60 hover:text-sidebar-accent-foreground focus-visible:ring-sidebar-ring" />
        <a
          href="https://github.com/sponsors/radiumcoders"
          target="_blank"
          rel="noopener noreferrer"
          className="ml-auto inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-[12px] font-medium text-sidebar-foreground/55 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
        >
          <HeartIcon size={12} weight="fill" />
          Sponsor
        </a>
      </div>
    </div>
  );
}

export function DocsSidebar({
  sections,
  defaultPageUrl,
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

  const nav = <DocsNav sections={sections} defaultPageUrl={defaultPageUrl} />;

  return (
    <>
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 self-start text-foreground md:block">
        <DocsSidebarChrome brand={brand}>{nav}</DocsSidebarChrome>
      </aside>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="fixed top-4 left-4 z-50 rounded-md bg-background/90 text-foreground/70 shadow-sm backdrop-blur md:hidden"
            aria-label="Open menu"
          >
            <ListIcon size={16} />
          </Button>
        </SheetTrigger>
        <SheetContent
          side="left"
          className="w-72 border-border bg-background p-0 text-foreground"
          showCloseButton
        >
          <SheetTitle className="sr-only">Docs</SheetTitle>
          <DocsSidebarChrome brand={brand}>{nav}</DocsSidebarChrome>
        </SheetContent>
      </Sheet>
    </>
  );
}
