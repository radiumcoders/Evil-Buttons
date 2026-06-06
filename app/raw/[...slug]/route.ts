import { getPageMarkdown } from "@/lib/markdown";
import { source } from "@/lib/source";

type RouteContext = {
  params: Promise<{ slug: string[] }>;
};

export async function GET(_request: Request, { params }: RouteContext) {
  const { slug } = await params;
  const markdown = await getPageMarkdown(slug);

  if (markdown === null) {
    return new Response("Not found", { status: 404 });
  }

  return new Response(markdown, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Cache-Control": "public, max-age=0, must-revalidate",
    },
  });
}

export function generateStaticParams() {
  return source.getPages().map((page) => ({ slug: page.slugs }));
}
