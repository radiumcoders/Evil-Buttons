import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getMDXComponents } from "@/components/mdx";
import { source } from "@/lib/source";

type DocsPageProps = {
  params: Promise<{
    slug?: string[];
  }>;
};

export default async function DocsPage({ params }: DocsPageProps) {
  const resolved = await params;
  const page = source.getPage(resolved.slug);

  if (!page) notFound();

  const MDX = page.data.body;
  const links = (
    page.data as { links?: { api?: string; doc?: string; github?: string } }
  ).links;

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-8">
      <article className="docs-content">
        <MDX components={getMDXComponents()} />
      </article>
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
  const page = source.getPage(resolved.slug);

  if (!page) {
    return {};
  }

  return {
    title: page.data.title,
    description: page.data.description,
  };
}
