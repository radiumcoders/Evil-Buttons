"use client";

import { useDialKit } from "dialkit";
import { useThemedDialKit } from "./theme";
import { RevealButton } from "@/components/evil-buttons/reveal-button";
import { HoldButton } from "@/components/evil-buttons/hold-button";
import { HoldConfirmButton } from "@/components/evil-buttons/hold-confirm-button";
import { SlideToDetonate } from "@/components/evil-buttons/slide-to-detonate";
import { DoubtButton } from "@/components/evil-buttons/doubt-button";
import { CaptchaButton } from "@/components/evil-buttons/captcha-button";
import { CooldownButton } from "@/components/evil-buttons/cooldown-button";
import { MorphStatusButton } from "@/components/evil-buttons/morph-status-button";

export function RevealButtonPreview() {
  const p = useDialKit(
    "RevealButton",
    {
      label: "Reveal",
      hiddenLabel: "Hidden",
      maskedValue: "•••• •••• ••••",
      secret: "sk_live_••••_9xQ4",
      revealMode: {
        type: "select",
        options: ["hold", "toggle"],
        default: "hold",
      },
    },
    { id: "reveal-button" },
  );

  return (
    <RevealButton
      label={p.label}
      hiddenLabel={p.hiddenLabel}
      maskedValue={p.maskedValue}
      secret={p.secret}
      revealMode={p.revealMode as "hold" | "toggle"}
    />
  );
}

export function HoldButtonPreview() {
  const p = useDialKit(
    "HoldButton",
    {
      label: "Hold to delete",
      holdingLabel: "Keep holding…",
      successLabel: "Deleted",
      duration: [1500, 500, 5000],
      resetAfter: [1400, 0, 5000],
    },
    { id: "hold-button" },
  );

  return (
    <HoldButton
      label={p.label}
      holdingLabel={p.holdingLabel}
      successLabel={p.successLabel}
      duration={p.duration}
      resetAfter={p.resetAfter}
    />
  );
}

export function HoldConfirmButtonPreview() {
  const p = useThemedDialKit(
    "HoldConfirmButton",
    (isDark) => ({
      label: "Hold to confirm",
      holdingLabel: "Keep holding…",
      successLabel: "Confirmed",
      duration: [2000, 500, 5000],
      resetAfter: [1600, 0, 5000],
      minScale: [0.9, 0.7, 1, 0.01],
      ring: {
        size: [280, 100, 400],
        strokeWidth: [12, 4, 24],
        color: isDark ? "#5eead4" : "#0d9488",
      },
    }),
    { id: "hold-confirm-button" },
  );

  return (
    <HoldConfirmButton
      label={p.label}
      holdingLabel={p.holdingLabel}
      successLabel={p.successLabel}
      duration={p.duration}
      resetAfter={p.resetAfter}
      minScale={p.minScale}
      ringSize={p.ring.size}
      ringStrokeWidth={p.ring.strokeWidth}
      ringColor={p.ring.color}
    />
  );
}

export function SlideToDetonatePreview() {
  const p = useDialKit(
    "SlideToDetonate",
    {
      label: "Slide to detonate",
      successLabel: "Detonated",
      threshold: [0.95, 0.5, 1, 0.01],
      resetAfter: [1600, 0, 5000],
    },
    { id: "slide-to-detonate" },
  );

  return (
    <SlideToDetonate
      label={p.label}
      successLabel={p.successLabel}
      threshold={p.threshold}
      resetAfter={p.resetAfter}
    />
  );
}

export function DoubtButtonPreview() {
  const p = useDialKit(
    "DoubtButton",
    {
      label: "Delete everything",
      successLabel: "Too late.",
      resetAfter: [1600, 0, 5000],
    },
    { id: "doubt-button" },
  );

  return (
    <DoubtButton
      label={p.label}
      successLabel={p.successLabel}
      resetAfter={p.resetAfter}
    />
  );
}

export function CaptchaButtonPreview() {
  const p = useDialKit(
    "CaptchaButton",
    {
      label: "Deploy Doom",
      successLabel: "Deployed",
      resetAfter: [1600, 0, 5000],
    },
    { id: "captcha-button" },
  );

  return (
    <CaptchaButton
      label={p.label}
      successLabel={p.successLabel}
      resetAfter={p.resetAfter}
    />
  );
}

export function CooldownButtonPreview() {
  const p = useDialKit(
    "CooldownButton",
    {
      label: "Send it",
      cooldown: [3000, 1000, 10000],
      showCountdown: true,
    },
    { id: "cooldown-button" },
  );

  return (
    <CooldownButton
      label={p.label}
      cooldown={p.cooldown}
      showCountdown={p.showCountdown}
    />
  );
}

export function MorphStatusButtonPreview() {
  const p = useDialKit(
    "MorphStatusButton",
    {
      label: "Save changes",
      loadingLabel: "Working…",
      successLabel: "Done",
      errorLabel: "It broke. Your fault.",
      resetAfter: [1800, 0, 5000],
    },
    { id: "morph-status-button" },
  );

  return (
    <MorphStatusButton
      label={p.label}
      loadingLabel={p.loadingLabel}
      successLabel={p.successLabel}
      errorLabel={p.errorLabel}
      resetAfter={p.resetAfter}
      onClick={() => new Promise((resolve) => setTimeout(resolve, 1200))}
    />
  );
}