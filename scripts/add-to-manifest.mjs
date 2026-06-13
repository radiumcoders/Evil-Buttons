#!/usr/bin/env node
// Prototype (plan 008, phase 1): append a new component entry to
// registry.components.json from CLI flags. Phase 1 ONLY touches the manifest —
// it does not write the component .tsx, the docs, or edit the MDX/landing
// registrations (those are phases 2 and 3 in plans/008-design-notes.md).
//
// Usage:
//   node scripts/add-to-manifest.mjs \
//     --name my-button --export-name MyButton --doc-slug my-button \
//     --title MyButton --description "A demo button." \
//     --file components/evil-buttons/my-button.tsx \
//     --deps clsx,tailwind-merge --registry-deps button [--dry-run] [--force]
import { readFile, writeFile } from "node:fs/promises";
import { execSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const manifestPath = resolve(root, "registry.components.json");

function parseArgs(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith("--")) throw new Error(`Unexpected argument: ${arg}`);
    const key = arg.slice(2);
    if (key === "force" || key === "dry-run") {
      options[key] = true;
      continue;
    }
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`Missing value for --${key}`);
    options[key] = value;
    index += 1;
  }
  return options;
}

function requireOption(options, key) {
  if (!options[key]) throw new Error(`Missing required option --${key}`);
  return options[key];
}

function joinList(value) {
  return value
    ? value.split(",").map((item) => item.trim()).filter(Boolean)
    : [];
}

const options = parseArgs(process.argv.slice(2));
const name = requireOption(options, "name");
const exportName = requireOption(options, "export-name");
const title = options.title ?? exportName;
const description = requireOption(options, "description");
const file = options.file ?? `components/evil-buttons/${name}.tsx`;
const docSlug = options["doc-slug"] ?? name;
const dependencies = joinList(options.deps);
const registryDependencies = joinList(options["registry-deps"]);

const manifest = JSON.parse(await readFile(manifestPath, "utf8"));

if (manifest.some((entry) => entry.name === name) && !options.force) {
  throw new Error(
    `registry.components.json already has an entry named "${name}". Pass --force to overwrite.`,
  );
}

// Stable key order, matching scripts/build-registry.mjs's buildItem ordering.
const entry = { name, exportName, docSlug, title, description, file };
if (registryDependencies.length) entry.registryDependencies = registryDependencies;
entry.dependencies = dependencies;

if (options["dry-run"]) {
  process.stdout.write(`${JSON.stringify(entry, null, 2)}\n`);
  process.exit(0);
}

const next = manifest
  .filter((existing) => existing.name !== name)
  .concat(entry);

await writeFile(manifestPath, `${JSON.stringify(next, null, 2)}\n`, "utf8");
console.log(`Added "${name}" to registry.components.json`);

// Close the loop: regenerate and validate. Surfaces missing component file or
// missing docs as a failing registry:test.
execSync("pnpm registry:build", { cwd: root, stdio: "inherit" });
execSync("pnpm registry:test", { cwd: root, stdio: "inherit" });
