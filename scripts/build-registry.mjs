import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

const registryDir = resolve(root, "public/r");

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
const gridButtonSource = await readFile(
  resolve(root, "components/evil-buttons/grid-button.tsx"),
  "utf8",
);
const ditherButtonSource = await readFile(
  resolve(root, "components/evil-buttons/dither-button.tsx"),
  "utf8",
);
const evilEyeButtonSource = await readFile(
  resolve(root, "components/evil-buttons/evil-eye-button.tsx"),
  "utf8",
);
const trollButtonSource = await readFile(
  resolve(root, "components/evil-buttons/troll-button.tsx"),
  "utf8",
);
const chromeButtonSource = await readFile(
  resolve(root, "components/evil-buttons/chrome-button.tsx"),
  "utf8",
);
const brutalButtonSource = await readFile(
  resolve(root, "components/evil-buttons/brutal-button.tsx"),
  "utf8",
);
const aquaButtonSource = await readFile(
  resolve(root, "components/evil-buttons/aqua-button.tsx"),
  "utf8",
);
const threeDButtonSource = await readFile(
  resolve(root, "components/evil-buttons/3d-button.tsx"),
  "utf8",
);
const frameButtonSource = await readFile(
  resolve(root, "components/evil-buttons/frame-button.tsx"),
  "utf8",
);
const highlightButtonSource = await readFile(
  resolve(root, "components/evil-buttons/highlight-button.tsx"),
  "utf8",
);
const glitchButtonSource = await readFile(
  resolve(root, "components/evil-buttons/glitch-button.tsx"),
  "utf8",
);
const commandButtonSource = await readFile(
  resolve(root, "components/evil-buttons/command-button.tsx"),
  "utf8",
);
const copyButtonSource = await readFile(
  resolve(root, "components/evil-buttons/copy-button.tsx"),
  "utf8",
);
const revealButtonSource = await readFile(
  resolve(root, "components/evil-buttons/reveal-button.tsx"),
  "utf8",
);
const demonicButtonSource = await readFile(
  resolve(root, "components/evil-buttons/demonic-button.tsx"),
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
    "A ticket-style button like a cinema stub.",
  files: [
    {
      path: "components/evil-buttons/movie-pass.tsx",
      type: "registry:ui",
      target: "components/evil-buttons/movie-pass.tsx",
      content: moviePassSource,
    },
  ],
  dependencies: [],
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

const ditherButtonItem = {
  $schema: "https://ui.shadcn.com/schema/registry-item.json",
  name: "dither-button",
  type: "registry:ui",
  title: "DitherButton",
  description:
    "A button with an animated 4x4 ordered-dither wave background and a knockout label.",
  files: [
    {
      path: "components/evil-buttons/dither-button.tsx",
      type: "registry:ui",
      target: "components/evil-buttons/dither-button.tsx",
      content: ditherButtonSource,
    },
  ],
  dependencies: ["clsx", "tailwind-merge"],
};

const evilEyeButtonItem = {
  $schema: "https://ui.shadcn.com/schema/registry-item.json",
  name: "evil-eye-button",
  type: "registry:ui",
  title: "EvilEyeButton",
  description:
    "A button with a React Bits evil eye shader background and a fiery readable label.",
  files: [
    {
      path: "components/evil-buttons/evil-eye-button.tsx",
      type: "registry:ui",
      target: "components/evil-buttons/evil-eye-button.tsx",
      content: evilEyeButtonSource,
    },
  ],
  registryDependencies: ["@react-bits/EvilEye-TS-TW"],
  dependencies: ["clsx", "tailwind-merge"],
};

const trollButtonItem = {
  $schema: "https://ui.shadcn.com/schema/registry-item.json",
  name: "troll-button",
  type: "registry:ui",
  title: "TrollButton",
  description:
    "A button that flees from the user's cursor.",
  files: [
    {
      path: "components/evil-buttons/troll-button.tsx",
      type: "registry:ui",
      target: "components/evil-buttons/troll-button.tsx",
      content: trollButtonSource,
    },
  ],
  registryDependencies: ["button"],
  dependencies: ["motion"],
};

const chromeButtonItem = {
  $schema: "https://ui.shadcn.com/schema/registry-item.json",
  name: "chrome-button",
  type: "registry:ui",
  title: "ChromeButton",
  description:
    "A button with an animated liquid chrome background.",
  files: [
    {
      path: "components/evil-buttons/chrome-button.tsx",
      type: "registry:ui",
      target: "components/evil-buttons/chrome-button.tsx",
      content: chromeButtonSource,
    },
  ],
  registryDependencies: ["@react-bits/LiquidChrome-TS-TW"],
  dependencies: [],
};

const brutalButtonItem = {
  $schema: "https://ui.shadcn.com/schema/registry-item.json",
  name: "brutal-button",
  type: "registry:ui",
  title: "BrutalButton",
  description:
    "A NeoBrutalism style button with sharp shadows and stark borders.",
  files: [
    {
      path: "components/evil-buttons/brutal-button.tsx",
      type: "registry:ui",
      target: "components/evil-buttons/brutal-button.tsx",
      content: brutalButtonSource,
    },
  ],
  dependencies: ["clsx", "tailwind-merge"],
};

const aquaButtonItem = {
  $schema: "https://ui.shadcn.com/schema/registry-item.json",
  name: "aqua-button",
  type: "registry:ui",
  title: "AquaButton",
  description:
    "A glossy pill button inspired by Apple's Aqua interface, with layered highlights and a soft inner glow.",
  files: [
    {
      path: "components/evil-buttons/aqua-button.tsx",
      type: "registry:ui",
      target: "components/evil-buttons/aqua-button.tsx",
      content: aquaButtonSource,
    },
  ],
  dependencies: ["clsx", "tailwind-merge"],
};

const threeDButtonItem = {
  $schema: "https://ui.shadcn.com/schema/registry-item.json",
  name: "3d-button",
  type: "registry:ui",
  title: "ThreeDButton",
  description: "A minimal 3D button with a clean deck-style press and sliding click sheen.",
  files: [
    {
      path: "components/evil-buttons/3d-button.tsx",
      type: "registry:ui",
      target: "components/evil-buttons/3d-button.tsx",
      content: threeDButtonSource,
    },
  ],
  dependencies: ["clsx", "tailwind-merge", "motion"],
};

const frameButtonItem = {
  $schema: "https://ui.shadcn.com/schema/registry-item.json",
  name: "frame-button",
  type: "registry:ui",
  title: "FrameButton",
  description:
    "A futuristic button with animated corner frames and tactile motion interactions.",
  files: [
    {
      path: "components/evil-buttons/frame-button.tsx",
      type: "registry:ui",
      target: "components/evil-buttons/frame-button.tsx",
      content: frameButtonSource,
    },
  ],
  dependencies: ["clsx", "tailwind-merge", "motion"],
};

const highlightButtonItem = {
  $schema: "https://ui.shadcn.com/schema/registry-item.json",
  name: "highlight-button",
  type: "registry:ui",
  title: "HighlightButton",
  description:
    "A button with a mouse-following highlight that darkens light surfaces and expands on click.",
  files: [
    {
      path: "components/evil-buttons/highlight-button.tsx",
      type: "registry:ui",
      target: "components/evil-buttons/highlight-button.tsx",
      content: highlightButtonSource,
    },
  ],
  registryDependencies: ["button"],
  dependencies: ["clsx", "tailwind-merge"],
};

const glitchButtonItem = {
  $schema: "https://ui.shadcn.com/schema/registry-item.json",
  name: "glitch-button",
  type: "registry:ui",
  title: "GlitchButton",
  description:
    "A button with randomized RGB-split glitch bursts, a scanline overlay, and a flickering label.",
  files: [
    {
      path: "components/evil-buttons/glitch-button.tsx",
      type: "registry:ui",
      target: "components/evil-buttons/glitch-button.tsx",
      content: glitchButtonSource,
    },
  ],
  dependencies: ["clsx", "tailwind-merge"],
};

const commandButtonItem = {
  $schema: "https://ui.shadcn.com/schema/registry-item.json",
  name: "command-button",
  type: "registry:ui",
  title: "CommandButton",
  description:
    "A button that binds a keyboard shortcut globally and pulses with a subtle flash animation when the shortcut fires.",
  files: [
    {
      path: "components/evil-buttons/command-button.tsx",
      type: "registry:ui",
      target: "components/evil-buttons/command-button.tsx",
      content: commandButtonSource,
    },
  ],
  dependencies: ["clsx", "tailwind-merge", "motion"],
};

const copyButtonItem = {
  $schema: "https://ui.shadcn.com/schema/registry-item.json",
  name: "copy-button",
  type: "registry:ui",
  title: "CopyButton",
  description:
    "A button that copies a value to the clipboard and transitions through idle, copied, and error states with animated icon swaps.",
  files: [
    {
      path: "components/evil-buttons/copy-button.tsx",
      type: "registry:ui",
      target: "components/evil-buttons/copy-button.tsx",
      content: copyButtonSource,
    },
  ],
  dependencies: ["clsx", "tailwind-merge", "motion"],
};

const revealButtonItem = {
  $schema: "https://ui.shadcn.com/schema/registry-item.json",
  name: "reveal-button",
  type: "registry:ui",
  title: "RevealButton",
  description:
    "A button that reveals a hidden secret value on hold or toggle, with a blur-in animation and an eye icon indicator.",
  files: [
    {
      path: "components/evil-buttons/reveal-button.tsx",
      type: "registry:ui",
      target: "components/evil-buttons/reveal-button.tsx",
      content: revealButtonSource,
    },
  ],
  dependencies: ["clsx", "tailwind-merge", "motion"],
};

const demonicButtonItem = {
  $schema: "https://ui.shadcn.com/schema/registry-item.json",
  name: "demonic-button",
  type: "registry:ui",
  title: "DemonicButton",
  description: "A button with devil horns that spring out on hover and a blood-red flash on click.",
  files: [
    {
      path: "components/evil-buttons/demonic-button.tsx",
      type: "registry:ui",
      target: "components/evil-buttons/demonic-button.tsx",
      content: demonicButtonSource,
    },
  ],
  dependencies: ["motion"],
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
        "A ticket-style button like a cinema stub.",
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
      name: "grid-button",
      type: "registry:ui",
      title: "GridButton",
      description:
        "A retro-styled button with a pixelated grid icon and tactile press feedback.",
      files: ["components/evil-buttons/grid-button.tsx"],
    },
    {
      name: "dither-button",
      type: "registry:ui",
      title: "DitherButton",
      description:
        "A button with an animated 4x4 ordered-dither wave background and a knockout label.",
      files: ["components/evil-buttons/dither-button.tsx"],
    },
    {
      name: "evil-eye-button",
      type: "registry:ui",
      title: "EvilEyeButton",
      description:
        "A button with a React Bits evil eye shader background and a fiery readable label.",
      files: ["components/evil-buttons/evil-eye-button.tsx"],
    },
    {
      name: "troll-button",
      type: "registry:ui",
      title: "TrollButton",
      description:
        "A button that flees from the user's cursor.",
      files: ["components/evil-buttons/troll-button.tsx"],
    },
    {
      name: "chrome-button",
      type: "registry:ui",
      title: "ChromeButton",
      description:
        "A button with an animated liquid chrome background.",
      files: ["components/evil-buttons/chrome-button.tsx"],
    },
    {
      name: "brutal-button",
      type: "registry:ui",
      title: "BrutalButton",
      description:
        "A NeoBrutalism style button with sharp shadows and stark borders.",
      files: ["components/evil-buttons/brutal-button.tsx"],
    },
    {
      name: "aqua-button",
      type: "registry:ui",
      title: "AquaButton",
      description:
        "A glossy pill button inspired by Apple's Aqua interface, with layered highlights and a soft inner glow.",
      files: ["components/evil-buttons/aqua-button.tsx"],
    },
    {
      name: "3d-button",
      type: "registry:ui",
      title: "ThreeDButton",
      description: "A minimal 3D button with a clean deck-style press and sliding click sheen.",
      files: ["components/evil-buttons/3d-button.tsx"],
    },
    {
      name: "frame-button",
      type: "registry:ui",
      title: "FrameButton",
      description:
        "A futuristic button with animated corner frames and tactile motion interactions.",
      files: ["components/evil-buttons/frame-button.tsx"],
    },
    {
      name: "highlight-button",
      type: "registry:ui",
      title: "HighlightButton",
      description:
        "A button with a mouse-following highlight that darkens light surfaces and expands on click.",
      files: ["components/evil-buttons/highlight-button.tsx"],
    },
    {
      name: "glitch-button",
      type: "registry:ui",
      title: "GlitchButton",
      description:
        "A button with randomized RGB-split glitch bursts, a scanline overlay, and a flickering label.",
      files: ["components/evil-buttons/glitch-button.tsx"],
    },
    {
      name: "command-button",
      type: "registry:ui",
      title: "CommandButton",
      description:
        "A button that binds a keyboard shortcut globally and pulses with a subtle flash animation when the shortcut fires.",
      files: ["components/evil-buttons/command-button.tsx"],
    },
    {
      name: "copy-button",
      type: "registry:ui",
      title: "CopyButton",
      description:
        "A button that copies a value to the clipboard and transitions through idle, copied, and error states with animated icon swaps.",
      files: ["components/evil-buttons/copy-button.tsx"],
    },
    {
      name: "reveal-button",
      type: "registry:ui",
      title: "RevealButton",
      description:
        "A button that reveals a hidden secret value on hold or toggle, with a blur-in animation and an eye icon indicator.",
      files: ["components/evil-buttons/reveal-button.tsx"],
    },
    {
      name: "demonic-button",
      type: "registry:ui",
      title: "DemonicButton",
      description: "A button with devil horns that spring out on hover and a blood-red flash on click.",
      files: ["components/evil-buttons/demonic-button.tsx"],
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
  resolve(registryDir, "grid-button.json"),
  `${JSON.stringify(gridButtonItem, null, 2)}\n`,
  "utf8",
);
await writeFile(
  resolve(registryDir, "dither-button.json"),
  `${JSON.stringify(ditherButtonItem, null, 2)}\n`,
  "utf8",
);
await writeFile(
  resolve(registryDir, "evil-eye-button.json"),
  `${JSON.stringify(evilEyeButtonItem, null, 2)}\n`,
  "utf8",
);
await writeFile(
  resolve(registryDir, "troll-button.json"),
  `${JSON.stringify(trollButtonItem, null, 2)}\n`,
  "utf8",
);
await writeFile(
  resolve(registryDir, "chrome-button.json"),
  `${JSON.stringify(chromeButtonItem, null, 2)}\n`,
  "utf8",
);
await writeFile(
  resolve(registryDir, "brutal-button.json"),
  `${JSON.stringify(brutalButtonItem, null, 2)}\n`,
  "utf8",
);
await writeFile(
  resolve(registryDir, "aqua-button.json"),
  `${JSON.stringify(aquaButtonItem, null, 2)}\n`,
  "utf8",
);
await writeFile(
  resolve(registryDir, "3d-button.json"),
  `${JSON.stringify(threeDButtonItem, null, 2)}\n`,
  "utf8",
);
await writeFile(
  resolve(registryDir, "frame-button.json"),
  `${JSON.stringify(frameButtonItem, null, 2)}\n`,
  "utf8",
);
await writeFile(
  resolve(registryDir, "highlight-button.json"),
  `${JSON.stringify(highlightButtonItem, null, 2)}\n`,
  "utf8",
);
await writeFile(
  resolve(registryDir, "glitch-button.json"),
  `${JSON.stringify(glitchButtonItem, null, 2)}\n`,
  "utf8",
);
await writeFile(
  resolve(registryDir, "command-button.json"),
  `${JSON.stringify(commandButtonItem, null, 2)}\n`,
  "utf8",
);
await writeFile(
  resolve(registryDir, "copy-button.json"),
  `${JSON.stringify(copyButtonItem, null, 2)}\n`,
  "utf8",
);
await writeFile(
  resolve(registryDir, "reveal-button.json"),
  `${JSON.stringify(revealButtonItem, null, 2)}\n`,
  "utf8",
);
await writeFile(
  resolve(registryDir, "demonic-button.json"),
  `${JSON.stringify(demonicButtonItem, null, 2)}\n`,
  "utf8",
);
await writeFile(
  resolve(registryDir, "index.json"),
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
console.log("- public/r/grid-button.json");
console.log("- public/r/dither-button.json");
console.log("- public/r/evil-eye-button.json");
console.log("- public/r/troll-button.json");
console.log("- public/r/chrome-button.json");
console.log("- public/r/brutal-button.json");
console.log("- public/r/aqua-button.json");
console.log("- public/r/3d-button.json");
console.log("- public/r/frame-button.json");
console.log("- public/r/highlight-button.json");
console.log("- public/r/glitch-button.json");
console.log("- public/r/command-button.json");
console.log("- public/r/copy-button.json");
console.log("- public/r/reveal-button.json");
console.log("- public/r/demonic-button.json");
