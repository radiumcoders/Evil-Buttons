import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

const componentPath = resolve(root, "components/evil-buttons/click-powerup.tsx");
const registryDir = resolve(root, "public/r");
const registryItemPath = resolve(registryDir, "click-powerup.json");
const registryIndexPath = resolve(registryDir, "index.json");

const componentSource = await readFile(componentPath, "utf8");

const item = {
  $schema: "https://ui.shadcn.com/schema/registry-item.json",
  name: "click-powerup",
  type: "registry:ui",
  title: "ClickPowerUp",
  description: "An animated button wrapper with corner brackets, patterned fill, and tap feedback.",
  files: [
    {
      path: "components/evil-buttons/click-powerup.tsx",
      type: "registry:ui",
      target: "components/evil-buttons/click-powerup.tsx",
      content: componentSource,
    },
  ],
  dependencies: ["motion", "clsx", "tailwind-merge"],
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
      description: "An animated button wrapper with corner brackets, patterned fill, and tap feedback.",
      files: ["components/evil-buttons/click-powerup.tsx"],
    },
  ],
};

await mkdir(registryDir, { recursive: true });
await writeFile(registryItemPath, `${JSON.stringify(item, null, 2)}\n`, "utf8");
await writeFile(registryIndexPath, `${JSON.stringify(index, null, 2)}\n`, "utf8");

console.log("Registry built:");
console.log("- public/r/index.json");
console.log("- public/r/click-powerup.json");
