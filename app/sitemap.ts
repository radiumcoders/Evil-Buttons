import type { MetadataRoute } from "next";
import { source } from "@/lib/source";
import { absoluteUrl } from "@/lib/seo";

export default function sitemap(): MetadataRoute.Sitemap {
  const pages = source.getPages();
  const now = new Date();

  const docEntries: MetadataRoute.Sitemap = pages.map((page) => ({
    url: absoluteUrl(page.url),
    lastModified: now,
    changeFrequency: "weekly",
    priority: page.url === "/docs" ? 1 : 0.8,
  }));

  const seen = new Set(docEntries.map((entry) => entry.url));

  if (!seen.has(absoluteUrl("/docs"))) {
    docEntries.unshift({
      url: absoluteUrl("/docs"),
      lastModified: now,
      changeFrequency: "weekly",
      priority: 1,
    });
  }

  const staticEntries: MetadataRoute.Sitemap = [
    // Each is unshifted in turn, so the last one here ends up first.
    {
      url: absoluteUrl("/stats"),
      lastModified: now,
      changeFrequency: "daily",
      priority: 0.5,
    },
    {
      url: absoluteUrl("/"),
      lastModified: now,
      changeFrequency: "weekly",
      priority: 1,
    },
  ];

  for (const entry of staticEntries) {
    if (!seen.has(entry.url)) {
      docEntries.unshift(entry);
      seen.add(entry.url);
    }
  }

  return docEntries;
}

export const dynamic = "force-static";
