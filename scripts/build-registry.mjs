import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

const componentPath = resolve(root, "components/evil-buttons/evil-button.tsx");
const registryDir = resolve(root, "public/r");
const registryItemPath = resolve(registryDir, "evil-button.json");
const registryIndexPath = resolve(registryDir, "index.json");

const componentSource = await readFile(componentPath, "utf8");

const item = {
  $schema: "https://ui.shadcn.com/schema/registry-item.json",
  name: "evil-button",
  type: "registry:ui",
  title: "Evil Button",
  description: "A clean, opinionated button from Evil Buttons.",
  files: [
    {
      path: "components/evil-buttons/evil-button.tsx",
      type: "registry:ui",
      target: "components/evil-buttons/evil-button.tsx",
      content: componentSource,
    },
  ],
  dependencies: ["clsx", "tailwind-merge"],
};

const index = {
  $schema: "https://ui.shadcn.com/schema/registry.json",
  name: "evil-buttons",
  homepage: "http://localhost:3000/docs",
  items: [
    {
      name: "evil-button",
      type: "registry:ui",
      title: "Evil Button",
      description: "A clean, opinionated button from Evil Buttons.",
      files: ["components/evil-buttons/evil-button.tsx"],
    },
  ],
};

await mkdir(registryDir, { recursive: true });
await writeFile(registryItemPath, `${JSON.stringify(item, null, 2)}\n`, "utf8");
await writeFile(registryIndexPath, `${JSON.stringify(index, null, 2)}\n`, "utf8");

console.log("Registry built:");
console.log("- public/r/index.json");
console.log("- public/r/evil-button.json");
