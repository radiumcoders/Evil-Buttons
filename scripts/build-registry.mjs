import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

const registryDir = resolve(root, "public/r");

// Single source of truth for every registry item, shared with the registry
// validator (scripts/test-registry.mjs). Order here is the order emitted in
// index.items. Only name/title/description/file/dependencies/registryDependencies
// are used for the registry output; exportName/docSlug drive coverage checks.
const components = JSON.parse(
  await readFile(resolve(root, "registry.components.json"), "utf8"),
);

// Reproduces the registry-item shape with a stable key order:
// $schema, name, type, title, description, files, [registryDependencies], dependencies.
function buildItem({ name, title, description, file, dependencies, registryDependencies }, content) {
  const path = file;
  const item = {
    $schema: "https://ui.shadcn.com/schema/registry-item.json",
    name,
    type: "registry:ui",
    title,
    description,
    files: [
      {
        path,
        type: "registry:ui",
        target: path,
        content,
      },
    ],
  };

  if (registryDependencies?.length) {
    item.registryDependencies = registryDependencies;
  }

  item.dependencies = dependencies ?? [];

  return item;
}

await mkdir(registryDir, { recursive: true });

for (const component of components) {
  const content = await readFile(resolve(root, component.file), "utf8");
  const item = buildItem(component, content);
  await writeFile(
    resolve(registryDir, `${component.name}.json`),
    `${JSON.stringify(item, null, 2)}\n`,
    "utf8",
  );
}

const index = {
  $schema: "https://ui.shadcn.com/schema/registry.json",
  name: "evil-buttons",
  homepage: "http://evilbuttons.radiumcoders.com/docs",
  items: components.map(({ name, title, description, file }) => ({
    name,
    type: "registry:ui",
    title,
    description,
    files: [file],
  })),
};

await writeFile(
  resolve(registryDir, "index.json"),
  `${JSON.stringify(index, null, 2)}\n`,
  "utf8",
);

console.log("Registry built:");
console.log("- public/r/index.json");
for (const { name } of components) {
  console.log(`- public/r/${name}.json`);
}
