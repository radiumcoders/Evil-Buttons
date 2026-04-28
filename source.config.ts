import { defineConfig, defineDocs } from "fumadocs-mdx/config";
import { pageSchema } from "fumadocs-core/source/schema";
import rehypePrettyCode from "rehype-pretty-code";
import z from "zod";

export const docs = defineDocs({
  dir: "content/docs",
  docs: {
    schema: pageSchema.extend({
      image: z.string().optional(),
      links: z
        .object({
          github: z.string().url().optional(),
          doc: z.string().url().optional(),
          api: z.string().url().optional(),
        })
        .optional(),
    }),
  },
});

export default defineConfig({
  mdxOptions: {
    rehypePlugins: (plugins) => {
      plugins.push([
        rehypePrettyCode,
        {
          theme: {
            light: "github-light",
            dark: "vesper",
          },
          defaultColor: false,
        },
      ]);

      return plugins;
    },
  },
});
