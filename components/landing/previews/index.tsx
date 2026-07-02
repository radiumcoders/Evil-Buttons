"use client";

import type { ComponentType } from "react";
import {
  RevealButtonPreview,
  HoldButtonPreview,
  HoldConfirmButtonPreview,
  SlideToDetonatePreview,
  DoubtButtonPreview,
  CaptchaButtonPreview,
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
} from "./visual";
import {
  CommandButtonPreview,
  CopyButtonPreview,
  ClickPowerUpPreview,
  PillButtonPreview,
} from "./utility";
import {
  DemonicButtonPreview,
  ChromeButtonPreview,
  GridButtonPreview,
  MinimalButtonPreview,
  MoviePassButtonPreview,
  ShinyButtonPreview,
  StickyButtonPreview,
  ThreeDButtonPreview,
  TrollButtonPreview,
} from "./simple";

const buttonPreviews: Record<string, ComponentType> = {
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
  "grid-button": GridButtonPreview,
  "highlight-button": HighlightButtonPreview,
  minimal: MinimalButtonPreview,
  "movie-pass": MoviePassButtonPreview,
  "shiny-button": ShinyButtonPreview,
  sticky: StickyButtonPreview,
  "3d-button": ThreeDButtonPreview,
  "troll-button": TrollButtonPreview,
  "captcha-button": CaptchaButtonPreview,
  "doubt-button": DoubtButtonPreview,
  "slide-to-detonate": SlideToDetonatePreview,
  "morph-status-button": MorphStatusButtonPreview,
  "cooldown-button": CooldownButtonPreview,
  "pill-button": PillButtonPreview,
  "confetti-button": ConfettiButtonPreview,
  "hold-confirm-button": HoldConfirmButtonPreview,
};

export function ButtonPreview({ registryName }: { registryName: string }) {
  const Preview = buttonPreviews[registryName];
  if (!Preview) return null;
  return <Preview />;
}