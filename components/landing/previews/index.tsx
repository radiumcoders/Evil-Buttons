"use client";

import type { ComponentType } from "react";
import {
  RevealButtonPreview,
  HoldButtonPreview,
  SlideToDetonatePreview,
  DoubtButtonPreview,
  CooldownButtonPreview,
  MorphStatusButtonPreview,
} from "./interaction";
import {
  BrutalButtonPreview,
  DitherButtonPreview,
  GlitchButtonPreview,
  EvilEyeButtonPreview,
  AquaButtonPreview,
  FrameButtonPreview,
  HighlightButtonPreview,
  ConfettiButtonPreview,
  AshBurstButtonPreview,
} from "./visual";
import {
  CommandButtonPreview,
  CopyButtonPreview,
  ClickPowerUpPreview,
  RealisticSwitchPreview,
} from "./utility";
import {
  DemonicButtonPreview,
  ChromeButtonPreview,
  MinimalButtonPreview,
  MoviePassButtonPreview,
  ShinyButtonPreview,
  StickyButtonPreview,
  ThreeDButtonPreview,
  TrollButtonPreview,
  MinecraftButtonPreview,
} from "./simple";
import {
  StaticRevealButtonPreview,
  StaticHoldButtonPreview,
  StaticSlideToDetonatePreview,
  StaticDoubtButtonPreview,
  StaticCooldownButtonPreview,
  StaticMorphStatusButtonPreview,
  StaticBrutalButtonPreview,
  StaticDitherButtonPreview,
  StaticGlitchButtonPreview,
  StaticEvilEyeButtonPreview,
  StaticAquaButtonPreview,
  StaticFrameButtonPreview,
  StaticHighlightButtonPreview,
  StaticConfettiButtonPreview,
  StaticAshBurstButtonPreview,
  StaticCommandButtonPreview,
  StaticCopyButtonPreview,
  StaticClickPowerUpPreview,
  StaticRealisticSwitchPreview,
  StaticDemonicButtonPreview,
  StaticChromeButtonPreview,
  StaticMinimalButtonPreview,
  StaticMoviePassButtonPreview,
  StaticShinyButtonPreview,
  StaticStickyButtonPreview,
  StaticThreeDButtonPreview,
  StaticTrollButtonPreview,
  StaticMinecraftButtonPreview,
} from "./static";

const dialButtonPreviews: Record<string, ComponentType> = {
  "reveal-button": RevealButtonPreview,
  "command-button": CommandButtonPreview,
  "copy-button": CopyButtonPreview,
  "click-powerup": ClickPowerUpPreview,
  "dither-button": DitherButtonPreview,
  "hold-button": HoldButtonPreview,
  "demonic-button": DemonicButtonPreview,
  "evil-eye-button": EvilEyeButtonPreview,
  "aqua-button": AquaButtonPreview,
  "brutal-button": BrutalButtonPreview,
  "chrome-button": ChromeButtonPreview,
  "frame-button": FrameButtonPreview,
  "glitch-button": GlitchButtonPreview,
  "highlight-button": HighlightButtonPreview,
  minimal: MinimalButtonPreview,
  "movie-pass": MoviePassButtonPreview,
  "shiny-button": ShinyButtonPreview,
  sticky: StickyButtonPreview,
  "3d-button": ThreeDButtonPreview,
  "troll-button": TrollButtonPreview,
  "doubt-button": DoubtButtonPreview,
  "slide-to-detonate": SlideToDetonatePreview,
  "morph-status-button": MorphStatusButtonPreview,
  "cooldown-button": CooldownButtonPreview,
  "realistic-switch": RealisticSwitchPreview,
  "confetti-button": ConfettiButtonPreview,
  "ash-burst-button": AshBurstButtonPreview,
  "minecraft-button": MinecraftButtonPreview,
};

const staticButtonPreviews: Record<string, ComponentType> = {
  "reveal-button": StaticRevealButtonPreview,
  "command-button": StaticCommandButtonPreview,
  "copy-button": StaticCopyButtonPreview,
  "click-powerup": StaticClickPowerUpPreview,
  "dither-button": StaticDitherButtonPreview,
  "hold-button": StaticHoldButtonPreview,
  "demonic-button": StaticDemonicButtonPreview,
  "evil-eye-button": StaticEvilEyeButtonPreview,
  "aqua-button": StaticAquaButtonPreview,
  "brutal-button": StaticBrutalButtonPreview,
  "chrome-button": StaticChromeButtonPreview,
  "frame-button": StaticFrameButtonPreview,
  "glitch-button": StaticGlitchButtonPreview,
  "highlight-button": StaticHighlightButtonPreview,
  minimal: StaticMinimalButtonPreview,
  "movie-pass": StaticMoviePassButtonPreview,
  "shiny-button": StaticShinyButtonPreview,
  sticky: StaticStickyButtonPreview,
  "3d-button": StaticThreeDButtonPreview,
  "troll-button": StaticTrollButtonPreview,
  "doubt-button": StaticDoubtButtonPreview,
  "slide-to-detonate": StaticSlideToDetonatePreview,
  "morph-status-button": StaticMorphStatusButtonPreview,
  "cooldown-button": StaticCooldownButtonPreview,
  "realistic-switch": StaticRealisticSwitchPreview,
  "confetti-button": StaticConfettiButtonPreview,
  "ash-burst-button": StaticAshBurstButtonPreview,
  "minecraft-button": StaticMinecraftButtonPreview,
};

export function hasDialPreview(registryName: string) {
  return registryName in dialButtonPreviews;
}

export function ButtonPreview({
  registryName,
  dial = false,
}: {
  registryName: string;
  dial?: boolean;
}) {
  const map = dial ? dialButtonPreviews : staticButtonPreviews;
  const Preview = map[registryName];
  if (!Preview) return null;
  return <Preview />;
}