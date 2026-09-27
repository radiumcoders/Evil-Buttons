#!/usr/bin/env node
import { mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";

function parseArgs(argv) {
  const options = {};

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (!arg.startsWith("--")) {
      throw new Error(`Unexpected argument: ${arg}`);
    }

    const key = arg.slice(2);

    if (key === "force" || key === "dry-run") {
      options[key] = true;
      continue;
    }

    const value = argv[index + 1];

    if (!value || value.startsWith("--")) {
      throw new Error(`Missing value for --${key}`);
    }

    options[key] = value;
    index += 1;
  }

  return options;
}

function requireOption(options, key) {
  if (!options[key]) {
    throw new Error(`Missing required option --${key}`);
  }

  return options[key];
}

function pascalCase(value) {
  return value
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}

function joinList(value) {
  return value
    ? value
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
    : [];
}

function formatInlineList(items) {
  if (items.length === 1) {
    return `\`${items[0]}\``;
  }

  if (items.length === 2) {
    return `\`${items[0]}\` and \`${items[1]}\``;
  }

  return `${items
    .slice(0, -1)
    .map((item) => `\`${item}\``)
    .join(", ")}, and \`${items.at(-1)}\``;
}

function quoteYaml(value) {
  return JSON.stringify(value);
}

function dependencySentence(deps, registryDeps) {
  const parts = [];

  if (deps.length > 0) {
    parts.push(`installs ${formatInlineList(deps)} as dependencies`);
  }

  if (registryDeps.length > 0) {
    parts.push(`uses ${formatInlineList(registryDeps)} as registry dependencies`);
  }

  return parts.length > 0 ? ` and ${parts.join(" and ")}` : "";
}

const options = parseArgs(process.argv.slice(2));
const registryName = requireOption(options, "name");
const title = options.title ?? pascalCase(registryName);
const description = requireOption(options, "description");
const componentFile = options["component-file"] ?? registryName;
const componentName = options.component ?? title;
const docSlug = options["doc-slug"] ?? registryName;
const exportStyle = options.export ?? "named";
const deps = joinList(options.deps);
const registryDeps = joinList(options["registry-deps"]);
const docsPath = resolve("content", "docs", `${docSlug}.mdx`);
const importPath = `@/components/evil-buttons/${componentFile}`;
const importLine =
  exportStyle === "default"
    ? `import ${componentName} from "${importPath}";`
    : `import { ${componentName} } from "${importPath}";`;

if (existsSync(docsPath) && !options.force) {
  throw new Error(`${docsPath} already exists. Pass --force to overwrite it.`);
}

const content = `---
title: ${quoteYaml(title)}
description: ${quoteYaml(description)}
---

${title} is ${description.charAt(0).toLowerCase()}${description.slice(1)}

## Preview

<PreviewCard live title="${title}" note="Interactive">
  <${componentName}>Deploy Doom</${componentName}>
</PreviewCard>

## Install

Add the item with the shadcn CLI.

<Cmd>@evilbuttons/${registryName}</Cmd>

## Usage

\`\`\`tsx
${importLine}

export function ButtonDemo() {
  return (
    <${componentName}>
      Launch
    </${componentName}>
  );
}
\`\`\`

## Props

| Prop        | Type              | Default | Description                          |
| ----------- | ----------------- | ------- | ------------------------------------ |
| \`children\`  | \`React.ReactNode\` | -       | The visible button label or content. |
| \`className\` | \`string\`          | -       | Extra classes passed to the button.  |

## Registry

The registry item includes \`components/evil-buttons/${componentFile}.tsx\`${dependencySentence(
  deps,
  registryDeps,
)}.
`;

if (options["dry-run"]) {
  process.stdout.write(content);
  process.exit(0);
}

await mkdir(dirname(docsPath), { recursive: true });
await writeFile(docsPath, content, "utf8");
console.log(`Created ${docsPath}`);
