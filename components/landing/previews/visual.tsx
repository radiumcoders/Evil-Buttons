"use client";

import { BrutalButton } from "@/components/evil-buttons/brutal-button";
import DitherButton from "@/components/evil-buttons/dither-button";
import { GlitchButton } from "@/components/evil-buttons/glitch-button";
import EvilEyeButton from "@/components/evil-buttons/evil-eye-button";
import { AquaButton } from "@/components/evil-buttons/aqua-button";
import { FrameButton } from "@/components/evil-buttons/frame-button";
import { HighlightButton } from "@/components/evil-buttons/highlight-button";
import { ConfettiButton } from "@/components/evil-buttons/confetti-button";
import { AshBurstButton } from "@/components/evil-buttons/ash-burst-button";
import { DeferredWebGLPreview } from "./shared";
import { themeColors, useThemedDialKit } from "./theme";

export function BrutalButtonPreview() {
  const p = useThemedDialKit(
    "BrutalButton",
    (isDark) => {
      const colors = isDark ? themeColors.dark : themeColors.light;
      return {
        label: "Click Me",
        color: colors.background,
        textColor: colors.foreground,
        borderColor: colors.foreground,
        shadowColor: colors.foreground,
        hasBorder: true,
        hasShadow: true,
        radius: [0, 0, 24],
      };
    },
    { id: "brutal-button-v2" },
  );

  return (
    <BrutalButton
      color={p.color}
      textColor={p.textColor}
      borderColor={p.borderColor}
      shadowColor={p.shadowColor}
      hasBorder={p.hasBorder}
      hasShadow={p.hasShadow}
      radius={p.radius}
    >
      {p.label}
    </BrutalButton>
  );
}

export function DitherButtonPreview() {
  const p = useThemedDialKit(
    "DitherButton",
    (isDark) => ({
      label: "Run It",
      ditherColor: isDark ? "#a3a3a3" : "#737373",
      ditherOpacity: [1, 0, 1, 0.01],
      ditherSize: [4, 1, 32],
    }),
    { id: "dither-button" },
  );

  return (
    <DitherButton
      ditherColor={p.ditherColor}
      ditherOpacity={p.ditherOpacity}
      ditherSize={p.ditherSize}
    >
      {p.label}
    </DitherButton>
  );
}

export function GlitchButtonPreview() {
  const p = useThemedDialKit(
    "GlitchButton",
    (isDark) => ({
      label: "Launch",
      glitchInterval: [3500, 500, 8000],
      glitchDuration: [450, 100, 1000],
      channelA: isDark ? "#ef4444" : "#dc2626",
      channelB: isDark ? "#22d3ee" : "#0891b2",
      intensity: [1, 0, 3, 0.1],
      trigger: {
        type: "select",
        options: ["auto", "hover", "always"],
        default: "hover",
      },
      scanlines: true,
    }),
    { id: "glitch-button" },
  );

  return (
    <GlitchButton
      glitchInterval={p.glitchInterval}
      glitchDuration={p.glitchDuration}
      colors={[p.channelA, p.channelB]}
      intensity={p.intensity}
      trigger={p.trigger as "auto" | "hover" | "always"}
      scanlines={p.scanlines}
    >
      {p.label}
    </GlitchButton>
  );
}

export function EvilEyeButtonPreview() {
  const p = useThemedDialKit(
    "EvilEyeButton",
    () => ({
      label: "Doom",
      effectOpacity: [0.95, 0, 1, 0.01],
      eye: {
        eyeColor: "#ff6f37",
        backgroundColor: "#000000",
        intensity: [1.65, 0, 3, 0.01],
        pupilSize: [0.62, 0, 1, 0.01],
        irisWidth: [0.22, 0, 1, 0.01],
        glowIntensity: [0.56, 0, 1, 0.01],
        scale: [1.15, 0.5, 2, 0.01],
        noiseScale: [1, 0, 2, 0.01],
        pupilFollow: [0.55, 0, 1, 0.01],
        flameSpeed: [0.8, 0, 2, 0.01],
      },
    }),
    { id: "evil-eye-button-v2" },
  );

  return (
    <DeferredWebGLPreview label={p.label}>
      <EvilEyeButton
        effectOpacity={p.effectOpacity}
        eyeColor={p.eye.eyeColor}
        backgroundColor={p.eye.backgroundColor}
        intensity={p.eye.intensity}
        pupilSize={p.eye.pupilSize}
        irisWidth={p.eye.irisWidth}
        glowIntensity={p.eye.glowIntensity}
        scale={p.eye.scale}
        noiseScale={p.eye.noiseScale}
        pupilFollow={p.eye.pupilFollow}
        flameSpeed={p.eye.flameSpeed}
      >
        {p.label}
      </EvilEyeButton>
    </DeferredWebGLPreview>
  );
}

export function AquaButtonPreview() {
  const p = useThemedDialKit(
    "AquaButton",
    () => ({
      label: "Deploy Doom",
      variant: {
        type: "select",
        options: ["primary", "secondary"],
        default: "primary",
      },
    }),
    { id: "aqua-button" },
  );

  return (
    <AquaButton variant={p.variant as "primary" | "secondary"}>
      {p.label}
    </AquaButton>
  );
}

export function FrameButtonPreview() {
  const p = useThemedDialKit(
    "FrameButton",
    () => ({
      label: "Deploy",
      variant: {
        type: "select",
        options: ["default", "secondary", "outline"],
        default: "default",
      },
      glow: false,
      size: [20, 8, 40],
      offset: [7.5, 0, 20, 0.5],
      hoverOffset: [7, 0, 20, 0.5],
    }),
    { id: "frame-button" },
  );

  return (
    <FrameButton
      variant={p.variant as "default" | "secondary" | "outline"}
      glow={p.glow}
      size={p.size}
      offset={p.offset}
      hoverOffset={p.hoverOffset}
    >
      {p.label}
    </FrameButton>
  );
}

export function HighlightButtonPreview() {
  const p = useThemedDialKit(
    "HighlightButton",
    (isDark) => {
      const colors = isDark ? themeColors.dark : themeColors.light;
      return {
        label: "Send",
        highlightColor: colors.foreground,
        highlightSize: [56, 20, 120],
        borderColor: colors.foreground,
      };
    },
    { id: "highlight-button-v2" },
  );

  return (
    <HighlightButton
      highlightColor={p.highlightColor}
      highlightSize={p.highlightSize}
      borderColor={p.borderColor}
    >
      {p.label}
    </HighlightButton>
  );
}

export function ConfettiButtonPreview() {
  const p = useThemedDialKit(
    "ConfettiButton",
    () => ({
      label: "Celebrate",
      particleCount: [120, 20, 300],
      spread: [72, 20, 180],
      startVelocity: [38, 10, 80],
    }),
    { id: "confetti-button" },
  );

  return (
    <ConfettiButton
      label={p.label}
      particleCount={p.particleCount}
      spread={p.spread}
      startVelocity={p.startVelocity}
    />
  );
}

export function AshBurstButtonPreview() {
  const p = useThemedDialKit(
    "AshBurstButton",
    () => ({
      label: "Destroy",
      particleCount: [96, 24, 180],
      spread: [120, 50, 180],
      startVelocity: [48, 20, 90],
    }),
    { id: "ash-burst-button" },
  );

  return (
    <AshBurstButton
      label={p.label}
      particleCount={p.particleCount}
      spread={p.spread}
      startVelocity={p.startVelocity}
    />
  );
}