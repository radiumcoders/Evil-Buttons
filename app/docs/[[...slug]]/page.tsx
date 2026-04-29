import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getMDXComponents } from "@/components/mdx";
import { PageToc } from "@/components/page-toc";
import { source } from "@/lib/source";

type DocsPageProps = {
  params: Promise<{
    slug?: string[];
  }>;
};

export default async function DocsPage({ params }: DocsPageProps) {
  const resolved = await params;
  const page = getDocsPage(resolved.slug);

  if (!page) notFound();

  const MDX = page.data.body;

  return (
    <div className="relative mx-auto w-full max-w-6xl px-6 pt-16 pb-8 md:py-8 xl:pr-64">
      <article className="docs-content mx-auto min-w-0 max-w-3xl">
        <MDX components={getMDXComponents()} />
      </article>
      <aside className="absolute top-8 right-6 hidden w-48 xl:block">
        <div className="sticky top-8 flex max-h-[calc(100dvh-4rem)] flex-col gap-3 overflow-y-auto border-l border-border pl-5">
          <p className="text-xs font-semibold text-muted-foreground">On this page</p>
          <PageToc />
        </div>
      </aside>
    </div>
  );
}

export async function generateStaticParams() {
  return source.generateParams();
}

export async function generateMetadata({
  params,
}: DocsPageProps): Promise<Metadata> {
  const resolved = await params;
  const page = getDocsPage(resolved.slug);

  if (!page) {
    return {};
  }

  return {
    title: page.data.title,
    description: page.data.description,
  };
}

function getDocsPage(slug?: string[]) {
  return source.getPage(slug && slug.length > 0 ? slug : ["introduction"]);
}
