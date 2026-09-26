"use client";
import { useDialKit } from "dialkit";

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
import {
  colorFolder,
  fromFolder,
  themeColors,
  useThemedDialKit,
} from "./theme";
import { LiveProps } from "./live-props";

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
    <LiveProps>
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
    </LiveProps>
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
    <LiveProps>
      <DitherButton
        ditherColor={p.ditherColor}
        ditherOpacity={p.ditherOpacity}
        ditherSize={p.ditherSize}
      >
        {p.label}
      </DitherButton>
    </LiveProps>
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
    <LiveProps>
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
    </LiveProps>
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
      <LiveProps>
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
      </LiveProps>
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
    <LiveProps>
      <AquaButton variant={p.variant as "primary" | "secondary"}>
        {p.label}
      </AquaButton>
    </LiveProps>
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
      size: [14, 6, 32],
      offset: [6, 0, 20, 0.5],
      hoverOffset: [5, 0, 20, 0.5],
    }),
    { id: "frame-button" },
  );

  return (
    <LiveProps>
      <FrameButton
        variant={p.variant as "default" | "secondary" | "outline"}
        glow={p.glow}
        size={p.size}
        offset={p.offset}
        hoverOffset={p.hoverOffset}
      >
        {p.label}
      </FrameButton>
    </LiveProps>
  );
}

export function HighlightButtonPreview() {
  const p = useDialKit(
    "HighlightButton",
    {
      label: "Send",
      variant: {
        type: "select",
        options: ["default", "secondary", "outline"],
        default: "default",
      },
      highlightSize: [90, 30, 200],
      // Off = the component's currentColor-derived defaults.
      customColors: false,
      highlightColor: { type: "color", default: "#a3a3a3" },
      borderColor: { type: "color", default: "#e5e5e5" },
    },
    { id: "highlight-button-v3" },
  );

  return (
    <LiveProps>
      <HighlightButton
        variant={p.variant as "default" | "secondary" | "outline"}
        highlightSize={p.highlightSize}
        highlightColor={p.customColors ? p.highlightColor : undefined}
        borderColor={p.customColors ? p.borderColor : undefined}
      >
        {p.label}
      </HighlightButton>
    </LiveProps>
  );
}

export function ConfettiButtonPreview() {
  const p = useThemedDialKit(
    "ConfettiButton",
    () => ({
      label: "Celebrate",
      particleCount: [80, 20, 300],
      spread: [64, 20, 180],
      startVelocity: [32, 10, 80],
      icon: true,
      colors: colorFolder([
        "#fafafa",
        "#d4d4d4",
        "#a3a3a3",
        "#93c5fd",
        "#c4b5fd",
        "#fcd34d",
      ]),
    }),
    { id: "confetti-button" },
  );

  return (
    <LiveProps>
      <ConfettiButton
        label={p.label}
        particleCount={p.particleCount}
        spread={p.spread}
        startVelocity={p.startVelocity}
        icon={p.icon}
        colors={fromFolder(p.colors)}
      />
    </LiveProps>
  );
}

export function AshBurstButtonPreview() {
  const p = useThemedDialKit(
    "AshBurstButton",
    () => ({
      label: "Delete",
      particleCount: [80, 24, 180],
      spread: [110, 50, 180],
      startVelocity: [42, 20, 90],
      icon: true,
      colors: colorFolder([
        "#171717",
        "#262626",
        "#404040",
        "#525252",
        "#737373",
        "#a3a3a3",
        "#b91c1c",
        "#f97316",
      ]),
    }),
    { id: "ash-burst-button" },
  );

  return (
    <LiveProps>
      <AshBurstButton
        label={p.label}
        particleCount={p.particleCount}
        spread={p.spread}
        startVelocity={p.startVelocity}
        icon={p.icon}
        colors={fromFolder(p.colors)}
      />
    </LiveProps>
  );
}