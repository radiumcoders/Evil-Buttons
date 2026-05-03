import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

const registryDir = resolve(root, "public/r");
const registryIndexPath = resolve(registryDir, "index.json");

// Read component sources
const clickPowerupSource = await readFile(
  resolve(root, "components/evil-buttons/click-powerup.tsx"),
  "utf8",
);
const stickySource = await readFile(
  resolve(root, "components/evil-buttons/sticky.tsx"),
  "utf8",
);
const shinySource = await readFile(
  resolve(root, "components/evil-buttons/shiny-button.tsx"),
  "utf8",
);
const moviePassSource = await readFile(
  resolve(root, "components/evil-buttons/movie-pass.tsx"),
  "utf8",
);
const minimalSource = await readFile(
  resolve(root, "components/evil-buttons/minimal.tsx"),
  "utf8",
);
const tanstackLogoSource = await readFile(
  resolve(root, "components/evil-buttons/logo/tanstack.tsx"),
  "utf8",
);
const shadcnLogoSource = await readFile(
  resolve(root, "components/evil-buttons/logo/shadcn.tsx"),
  "utf8",
);
const vercelLogoSource = await readFile(
  resolve(root, "components/evil-buttons/logo/vercel.tsx"),
  "utf8",
);
const scrollBarsSource = await readFile(
  resolve(root, "components/evil-buttons/scroll-bars.tsx"),
  "utf8",
);
const gridButtonSource = await readFile(
  resolve(root, "components/evil-buttons/grid-button.tsx"),
  "utf8",
);

const clickPowerupItem = {
  $schema: "https://ui.shadcn.com/schema/registry-item.json",
  name: "click-powerup",
  type: "registry:ui",
  title: "ClickPowerUp",
  description:
    "An animated button wrapper with corner brackets, patterned fill, and tap feedback.",
  files: [
    {
      path: "components/evil-buttons/click-powerup.tsx",
      type: "registry:ui",
      target: "components/evil-buttons/click-powerup.tsx",
      content: clickPowerupSource,
    },
  ],
  dependencies: ["motion", "clsx", "tailwind-merge"],
};

const stickyItem = {
  $schema: "https://ui.shadcn.com/schema/registry-item.json",
  name: "sticky",
  type: "registry:ui",
  title: "StickyButton",
  description:
    "A magnetic button that follows cursor movement with spring physics.",
  files: [
    {
      path: "components/evil-buttons/sticky.tsx",
      type: "registry:ui",
      target: "components/evil-buttons/sticky.tsx",
      content: stickySource,
    },
  ],
  dependencies: ["motion", "clsx", "tailwind-merge"],
};

const shinyItem = {
  $schema: "https://ui.shadcn.com/schema/registry-item.json",
  name: "shiny-button",
  type: "registry:ui",
  title: "ShinyButton",
  description:
    "A glossy, gradient-styled button with a layered inner glow and press feedback.",
  files: [
    {
      path: "components/evil-buttons/shiny-button.tsx",
      type: "registry:ui",
      target: "components/evil-buttons/shiny-button.tsx",
      content: shinySource,
    },
  ],
  dependencies: [],
};

const moviePassItem = {
  $schema: "https://ui.shadcn.com/schema/registry-item.json",
  name: "movie-pass",
  type: "registry:ui",
  title: "MoviePassButton",
  description:
    "A ticket-style button with a tear-off animation, like a cinema stub.",
  files: [
    {
      path: "components/evil-buttons/movie-pass.tsx",
      type: "registry:ui",
      target: "components/evil-buttons/movie-pass.tsx",
      content: moviePassSource,
    },
  ],
  dependencies: ["motion", "clsx", "tailwind-merge"],
};

const minimalItem = {
  $schema: "https://ui.shadcn.com/schema/registry-item.json",
  name: "minimal",
  type: "registry:ui",
  title: "MinimalButton",
  description:
    "A sleek, minimal button with a subtle repeating linear gradient pattern.",
  files: [
    {
      path: "components/evil-buttons/minimal.tsx",
      type: "registry:ui",
      target: "components/evil-buttons/minimal.tsx",
      content: minimalSource,
    },
  ],
  registryDependencies: [
    "button"
  ],
  dependencies: ["clsx", "tailwind-merge"],
};

const tanstackLogoItem = {
  $schema: "https://ui.shadcn.com/schema/registry-item.json",
  name: "tanstack-logo",
  type: "registry:ui",
  title: "TanStackLogo",
  description:
    "An animated TanStack logo button with ripple effects and scale animation.",
  files: [
    {
      path: "components/evil-buttons/logo/tanstack.tsx",
      type: "registry:ui",
      target: "components/evil-buttons/logo/tanstack.tsx",
      content: tanstackLogoSource,
    },
  ],
  dependencies: ["motion", "clsx", "tailwind-merge"],
};

const shadcnLogoItem = {
  $schema: "https://ui.shadcn.com/schema/registry-item.json",
  name: "shadcn-logo",
  type: "registry:ui",
  title: "ShadcnLogo",
  description:
    "An animated shadcn/ui logo button with pixel reveal and glow effects.",
  files: [
    {
      path: "components/evil-buttons/logo/shadcn.tsx",
      type: "registry:ui",
      target: "components/evil-buttons/logo/shadcn.tsx",
      content: shadcnLogoSource,
    },
  ],
  dependencies: ["motion", "clsx", "tailwind-merge"],
};

const vercelLogoItem = {
  $schema: "https://ui.shadcn.com/schema/registry-item.json",
  name: "vercel-logo",
  type: "registry:ui",
  title: "VercelLogo",
  description:
    "An animated Vercel logo button with a sleek triangle reveal animation.",
  files: [
    {
      path: "components/evil-buttons/logo/vercel.tsx",
      type: "registry:ui",
      target: "components/evil-buttons/logo/vercel.tsx",
      content: vercelLogoSource,
    },
  ],
  dependencies: ["motion", "clsx", "tailwind-merge"],
};

const scrollBarsItem = {
  $schema: "https://ui.shadcn.com/schema/registry-item.json",
  name: "scroll-bars",
  type: "registry:ui",
  title: "ScrollBars",
  description:
    "Animated scroll progress bars with a vintage audio level meter aesthetic.",
  files: [
    {
      path: "components/evil-buttons/scroll-bars.tsx",
      type: "registry:ui",
      target: "components/evil-buttons/scroll-bars.tsx",
      content: scrollBarsSource,
    },
  ],
  dependencies: ["motion", "clsx", "tailwind-merge"],
};

const gridButtonItem = {
  $schema: "https://ui.shadcn.com/schema/registry-item.json",
  name: "grid-button",
  type: "registry:ui",
  title: "GridButton",
  description:
    "A retro-styled button with a pixelated grid icon and tactile press feedback.",
  files: [
    {
      path: "components/evil-buttons/grid-button.tsx",
      type: "registry:ui",
      target: "components/evil-buttons/grid-button.tsx",
      content: gridButtonSource,
    },
  ],
  registryDependencies: ["@dotmatrix/dotm-square-11"],
  dependencies: ["clsx", "tailwind-merge"],
};

const index = {
  $schema: "https://ui.shadcn.com/schema/registry.json",
  name: "evil-buttons",
  homepage: "http://evilbuttons.radiumcoders.com/docs",
  items: [
    {
      name: "click-powerup",
      type: "registry:ui",
      title: "ClickPowerUp",
      description:
        "An animated button wrapper with corner brackets, patterned fill, and tap feedback.",
      files: ["components/evil-buttons/click-powerup.tsx"],
    },
    {
      name: "sticky",
      type: "registry:ui",
      title: "StickyButton",
      description:
        "A magnetic button that follows cursor movement with spring physics.",
      files: ["components/evil-buttons/sticky.tsx"],
    },
    {
      name: "shiny-button",
      type: "registry:ui",
      title: "ShinyButton",
      description:
        "A glossy, gradient-styled button with a layered inner glow and press feedback.",
      files: ["components/evil-buttons/shiny-button.tsx"],
    },
    {
      name: "movie-pass",
      type: "registry:ui",
      title: "MoviePassButton",
      description:
        "A ticket-style button with a tear-off animation, like a cinema stub.",
      files: ["components/evil-buttons/movie-pass.tsx"],
    },
    {
      name: "minimal",
      type: "registry:ui",
      title: "MinimalButton",
      description:
        "A sleek, minimal button with a subtle repeating linear gradient pattern.",
      files: ["components/evil-buttons/minimal.tsx"],
    },
    {
      name: "tanstack-logo",
      type: "registry:ui",
      title: "TanStackLogo",
      description:
        "An animated TanStack logo button with ripple effects and scale animation.",
      files: ["components/evil-buttons/logo/tanstack.tsx"],
    },
    {
      name: "shadcn-logo",
      type: "registry:ui",
      title: "ShadcnLogo",
      description:
        "An animated shadcn/ui logo button with pixel reveal and glow effects.",
      files: ["components/evil-buttons/logo/shadcn.tsx"],
    },
    {
      name: "vercel-logo",
      type: "registry:ui",
      title: "VercelLogo",
      description:
        "An animated Vercel logo button with a sleek triangle reveal animation.",
      files: ["components/evil-buttons/logo/vercel.tsx"],
    },
    {
      name: "scroll-bars",
      type: "registry:ui",
      title: "ScrollBars",
      description:
        "Animated scroll progress bars with a vintage audio level meter aesthetic.",
      files: ["components/evil-buttons/scroll-bars.tsx"],
    },
    {
      name: "grid-button",
      type: "registry:ui",
      title: "GridButton",
      description:
        "A retro-styled button with a pixelated grid icon and tactile press feedback.",
      files: ["components/evil-buttons/grid-button.tsx"],
    },
  ],
};

await mkdir(registryDir, { recursive: true });
await writeFile(
  resolve(registryDir, "click-powerup.json"),
  `${JSON.stringify(clickPowerupItem, null, 2)}\n`,
  "utf8",
);
await writeFile(
  resolve(registryDir, "sticky.json"),
  `${JSON.stringify(stickyItem, null, 2)}\n`,
  "utf8",
);
await writeFile(
  resolve(registryDir, "shiny-button.json"),
  `${JSON.stringify(shinyItem, null, 2)}\n`,
  "utf8",
);
await writeFile(
  resolve(registryDir, "movie-pass.json"),
  `${JSON.stringify(moviePassItem, null, 2)}\n`,
  "utf8",
);
await writeFile(
  resolve(registryDir, "minimal.json"),
  `${JSON.stringify(minimalItem, null, 2)}\n`,
  "utf8",
);
await writeFile(
  resolve(registryDir, "tanstack-logo.json"),
  `${JSON.stringify(tanstackLogoItem, null, 2)}\n`,
  "utf8",
);
await writeFile(
  resolve(registryDir, "shadcn-logo.json"),
  `${JSON.stringify(shadcnLogoItem, null, 2)}\n`,
  "utf8",
);
await writeFile(
  resolve(registryDir, "vercel-logo.json"),
  `${JSON.stringify(vercelLogoItem, null, 2)}\n`,
  "utf8",
);
await writeFile(
  resolve(registryDir, "scroll-bars.json"),
  `${JSON.stringify(scrollBarsItem, null, 2)}\n`,
  "utf8",
);
await writeFile(
  resolve(registryDir, "grid-button.json"),
  `${JSON.stringify(gridButtonItem, null, 2)}\n`,
  "utf8",
);
await writeFile(
  registryIndexPath,
  `${JSON.stringify(index, null, 2)}\n`,
  "utf8",
);

console.log("Registry built:");
console.log("- public/r/index.json");
console.log("- public/r/click-powerup.json");
console.log("- public/r/sticky.json");
console.log("- public/r/shiny-button.json");
console.log("- public/r/movie-pass.json");
console.log("- public/r/minimal.json");
console.log("- public/r/tanstack-logo.json");
console.log("- public/r/shadcn-logo.json");
console.log("- public/r/vercel-logo.json");
console.log("- public/r/scroll-bars.json");
console.log("- public/r/grid-button.json");
