import { resolve } from "node:path";

const root = resolve(__dirname, "../..");

export const ogConfig = {
  baseUrl: "http://localhost:3000",
  viewport: { width: 1200, height: 630 },
  outputDir: resolve(root, "public/og"),
  components: [
    {
      slug: "grid-button",
      sourceFile: resolve(root, "components/evil-buttons/grid-button.tsx"),
    },
    {
      slug: "click-power-up",
      sourceFile: resolve(root, "components/evil-buttons/click-powerup.tsx"),
    },
    {
      slug: "sticky-button",
      sourceFile: resolve(root, "components/evil-buttons/sticky.tsx"),
    },
    {
      slug: "shiny-button",
      sourceFile: resolve(root, "components/evil-buttons/shiny-button.tsx"),
    },
    {
      slug: "movie-pass",
      sourceFile: resolve(root, "components/evil-buttons/movie-pass.tsx"),
    },
    {
      slug: "minimal-button",
      sourceFile: resolve(root, "components/evil-buttons/minimal.tsx"),
    },
    {
      slug: "logos/tanstack",
      sourceFile: resolve(root, "components/evil-buttons/logo/tanstack.tsx"),
    },
    {
      slug: "logos/shadcn",
      sourceFile: resolve(root, "components/evil-buttons/logo/shadcn.tsx"),
    },
    {
      slug: "logos/vercel",
      sourceFile: resolve(root, "components/evil-buttons/logo/vercel.tsx"),
    },
    {
      slug: "scroll-bars",
      sourceFile: resolve(root, "components/evil-buttons/scroll-bars.tsx"),
    },
  ] as const,
};

export type OgComponent = (typeof ogConfig.components)[number];