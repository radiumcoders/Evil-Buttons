import { readFile } from "node:fs/promises";
import path from "node:path";
import { source } from "@/lib/source";

const CONTENT_DIR = path.join(process.cwd(), "content/docs");

function stripFrontmatter(raw: string): string {
  const match = raw.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/);
  return match ? raw.slice(match[0].length) : raw;
}

/**
 * Reads the source `.mdx` file for a docs page and returns a clean Markdown
 * document: an H1 title, the description, then the raw body (frontmatter
 * stripped). Used for the "Copy Markdown" / "View as Markdown" actions and as
 * the payload handed to external AI tools.
 */
export async function getPageMarkdown(slug: string[]): Promise<string | null> {
  const page = source.getPage(slug);

  if (!page) return null;

  const filePath = page.absolutePath ?? path.join(CONTENT_DIR, page.path);
  const raw = await readFile(filePath, "utf8");
  const body = stripFrontmatter(raw).trim();

  const title = page.data.title ?? page.slugs.at(-1) ?? "Untitled";
  const description = page.data.description;

  const header = description ? `# ${title}\n\n${description}\n` : `# ${title}\n`;

  return `${header}\n${body}\n`;
}
