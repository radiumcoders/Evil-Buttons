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
  registryIndexPath,
  `${JSON.stringify(index, null, 2)}\n`,
  "utf8",
);

console.log("Registry built:");
console.log("- public/r/index.json");
console.log("- public/r/click-powerup.json");
console.log("- public/r/sticky.json");
console.log("- public/r/shiny-button.json");
