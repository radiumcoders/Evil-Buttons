import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { CliBlock } from "@/components/cli-block";
import { siteConfig } from "@/lib/seo";

type RegistryIndex = {
  name: string;
  homepage: string;
  items: {
    name: string;
    title: string;
    description: string;
    files: string[];
  }[];
};

async function getRegistryIndex(): Promise<RegistryIndex> {
  const indexPath = resolve(process.cwd(), "public/r/index.json");
  const raw = await readFile(indexPath, "utf8");
  return JSON.parse(raw) as RegistryIndex;
}

async function getDocUrlsByRegistryName() {
  const docsPath = resolve(process.cwd(), "content/docs");
  const files = await readdir(docsPath);
  const map = new Map<string, string>();

  for (const file of files) {
    if (!file.endsWith(".mdx")) continue;

    const content = await readFile(resolve(docsPath, file), "utf8");
    const match = content.match(/@evilbuttons\/([a-z0-9-]+)/);

    if (match) {
      map.set(match[1], `/docs/${file.replace(/\.mdx$/, "")}`);
    }
  }

  return map;
}

// A development check of every registry item; not part of the public site.
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function RegistryTestPage() {
  if (process.env.NODE_ENV === "production") notFound();

  const index = await getRegistryIndex();
  const docUrls = await getDocUrlsByRegistryName();

  return (
    <div className="mx-auto min-h-dvh max-w-4xl px-6 py-10 md:px-8">
      <div className="mb-10 space-y-3">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
          Registry test bench
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">
          {siteConfig.registryNamespace} items
        </h1>
        <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Run <code className="font-mono text-foreground">pnpm registry:test</code>{" "}
          to validate generated JSON against source files. With{" "}
          <code className="font-mono text-foreground">pnpm dev</code> running, install
          any item locally using the commands below.
        </p>
        <div className="flex flex-wrap gap-3 text-sm">
          <Link
            href="/docs"
            className="text-muted-foreground transition-colors hover:text-foreground"
          >
            Back to docs
          </Link>
          <a
            href="/r/index.json"
            className="text-muted-foreground transition-colors hover:text-foreground"
          >
            View index.json
          </a>
        </div>
      </div>

      <div className="space-y-8">
        {index.items.map((item) => (
          <section
            key={item.name}
            className="border border-border bg-background p-5"
          >
            <div className="mb-4 space-y-1">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <h2 className="text-lg font-semibold">{item.title}</h2>
                <span className="font-mono text-xs text-muted-foreground">
                  {item.name}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">{item.description}</p>
              <p className="font-mono text-xs text-muted-foreground">
                {item.files.join(", ")}
              </p>
            </div>

            <CliBlock commands={[`${siteConfig.registryNamespace}/${item.name}`]} />

            <div className="mt-3 flex flex-wrap gap-4 text-xs">
              <a
                href={`/r/${item.name}.json`}
                className="font-mono text-muted-foreground transition-colors hover:text-foreground"
              >
                /r/{item.name}.json
              </a>
              {docUrls.get(item.name) ? (
                <Link
                  href={docUrls.get(item.name)!}
                  className="text-muted-foreground transition-colors hover:text-foreground"
                >
                  Docs
                </Link>
              ) : null}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
