export type ShowcaseEntry = {
  name: string;
  href: string;
  registryName: string;
  /** Values of the component's `variant` prop, default first. */
  variants?: readonly string[];
};

export const showcase: ShowcaseEntry[] = [
  { name: "RevealButton", href: "/docs/reveal-button", registryName: "reveal-button", variants: ["dark", "light"] },
  { name: "CommandButton", href: "/docs/command-button", registryName: "command-button" },
  { name: "CopyButton", href: "/docs/copy-button", registryName: "copy-button" },
  { name: "ClickPowerUp", href: "/docs/click-power-up", registryName: "click-powerup" },
  { name: "DitherButton", href: "/docs/dither-button", registryName: "dither-button" },
  { name: "HoldButton", href: "/docs/hold-button", registryName: "hold-button" },
  { name: "DemonicButton", href: "/docs/demonic-button", registryName: "demonic-button" },
  { name: "EvilEyeButton", href: "/docs/evil-eye-button", registryName: "evil-eye-button" },
  { name: "AquaButton", href: "/docs/aqua-button", registryName: "aqua-button", variants: ["primary", "secondary"] },
  { name: "BrutalButton", href: "/docs/brutal-button", registryName: "brutal-button" },
  { name: "ChromeButton", href: "/docs/chrome-button", registryName: "chrome-button" },
  { name: "FrameButton", href: "/docs/frame-button", registryName: "frame-button", variants: ["default", "secondary", "outline"] },
  { name: "GlitchButton", href: "/docs/glitch-button", registryName: "glitch-button" },
  { name: "HighlightButton", href: "/docs/highlight-button", registryName: "highlight-button", variants: ["default", "secondary", "outline"] },
  { name: "MinimalButton", href: "/docs/minimal-button", registryName: "minimal" },
  { name: "MoviePassButton", href: "/docs/movie-pass", registryName: "movie-pass", variants: ["tilt", "snap"] },
  { name: "ShinyButton", href: "/docs/shiny-button", registryName: "shiny-button" },
  { name: "StickyButton", href: "/docs/sticky-button", registryName: "sticky" },
  { name: "ThreeDButton", href: "/docs/3d-button", registryName: "3d-button" },
  { name: "TrollButton", href: "/docs/troll-button", registryName: "troll-button" },
  { name: "DoubtButton", href: "/docs/doubt-button", registryName: "doubt-button" },
  { name: "SlideToDetonate", href: "/docs/slide-to-detonate", registryName: "slide-to-detonate", variants: ["dark", "light"] },
  { name: "MorphStatusButton", href: "/docs/morph-status-button", registryName: "morph-status-button" },
  { name: "CooldownButton", href: "/docs/cooldown-button", registryName: "cooldown-button" },
  { name: "RealisticSwitch", href: "/docs/realistic-switch", registryName: "realistic-switch" },
  { name: "ConfettiButton", href: "/docs/confetti-button", registryName: "confetti-button" },
  { name: "AshBurstButton", href: "/docs/ash-burst-button", registryName: "ash-burst-button" },
  { name: "MinecraftButton", href: "/docs/minecraft-button", registryName: "minecraft-button" },
];