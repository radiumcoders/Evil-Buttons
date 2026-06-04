import Link from "next/link";
import Image from "next/image";
import { ThemeSync } from "@/components/theme-sync";
import { siteConfig } from "@/lib/seo";

const navLinks = [
  { href: "/docs", label: "Docs" },
  { href: `${siteConfig.github}`, label: "GitHub", external: true },
];

export function LandingNavbar() {
  return (
    <header className="border-b border-border bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <ThemeSync />
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-6">
        <Link
          href="/"
          className="group flex items-center gap-2 text-base font-semibold tracking-tight text-foreground transition-colors hover:text-muted-foreground"
        >
          <Image
            src="/logo.svg"
            alt={siteConfig.name}
            width={22}
            height={22}
            className="dark:invert"
          />
          <span>{siteConfig.name}</span>
        </Link>

        <nav className="flex items-center gap-1">
          {navLinks.map((link) =>
            link.external ? (
              <a
                key={link.href}
                href={link.href}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-8 items-center px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                {link.label}
              </a>
            ) : (
              <Link
                key={link.href}
                href={link.href}
                className="inline-flex h-8 items-center px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                {link.label}
              </Link>
            ),
          )}
        </nav>
      </div>
    </header>
  );
}
