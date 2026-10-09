"use client";

import { useDialKit } from "dialkit";
import { fromFolder, listFolder } from "./theme";
import { RevealButton } from "@/components/evil-buttons/reveal-button";
import { HoldButton } from "@/components/evil-buttons/hold-button";
import { SlideToDetonate } from "@/components/detonation/slide-to-detonate";
import { DoubtButton } from "@/components/easter-eggs/buttons";
import { CooldownButton } from "@/components/evil-buttons/cooldown-button";
import { MorphStatusButton } from "@/components/evil-buttons/morph-status-button";
import { LiveProps } from "./live-props";

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
      variant: {
        type: "select",
        options: ["dark", "light"],
        default: "dark",
      },
    },
    { id: "reveal-button" },
  );

  return (
    <LiveProps>
      <RevealButton
        label={p.label}
        hiddenLabel={p.hiddenLabel}
        maskedValue={p.maskedValue}
        secret={p.secret}
        revealMode={p.revealMode as "hold" | "toggle"}
        variant={p.variant as "dark" | "light"}
      />
    </LiveProps>
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
    <LiveProps>
      <HoldButton
        label={p.label}
        holdingLabel={p.holdingLabel}
        successLabel={p.successLabel}
        duration={p.duration}
        resetAfter={p.resetAfter}
      />
    </LiveProps>
  );
}

export function SlideToDetonatePreview() {
  const p = useDialKit(
    "SlideToDetonate",
    {
      label: "Slide to detonate",
      threshold: [0.9, 0.5, 1, 0.01],
      resistance: [0.35, 0, 1, 0.05],
      smoothness: [0.4, 0, 1, 0.05],
      variant: {
        type: "select",
        options: ["dark", "light"],
        default: "dark",
      },
      resetAfter: [1600, 0, 5000],
    },
    { id: "slide-to-detonate" },
  );

  return (
    <LiveProps>
      <SlideToDetonate
        label={p.label}
        threshold={p.threshold}
        resistance={p.resistance}
        smoothness={p.smoothness}
        variant={p.variant as "dark" | "light"}
        resetAfter={p.resetAfter}
      />
    </LiveProps>
  );
}

export function DoubtButtonPreview() {
  const p = useDialKit(
    "DoubtButton",
    {
      label: "Delete everything",
      successLabel: "Too late.",
      resetAfter: [1600, 0, 5000],
      confirmations: listFolder([
        "Are you sure?",
        "Really, truly sure?",
        "There is no undo. Still?",
        "Think of the consequences.",
        "I am obligated to ask again.",
        "Last chance. Absolutely certain?",
      ]),
    },
    { id: "doubt-button" },
  );

  return (
    <LiveProps>
      <DoubtButton
        label={p.label}
        successLabel={p.successLabel}
        resetAfter={p.resetAfter}
        confirmations={fromFolder(p.confirmations)}
      />
    </LiveProps>
  );
}


export function CooldownButtonPreview() {
  const p = useDialKit(
    "CooldownButton",
    {
      label: "Send it",
      cooldown: [3000, 1000, 10000],
      showCountdown: true,
      taunts: listFolder([
        "Patience.",
        "Again? Wait.",
        "Not so fast.",
        "Cool it.",
        "Hold your horses.",
      ]),
    },
    { id: "cooldown-button" },
  );

  return (
    <LiveProps>
      <CooldownButton
        label={p.label}
        cooldown={p.cooldown}
        showCountdown={p.showCountdown}
        taunts={fromFolder(p.taunts)}
      />
    </LiveProps>
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
      status: {
        type: "select",
        options: [
          { value: "auto", label: "Auto (click)" },
          "idle",
          "loading",
          "success",
          "error",
        ],
        default: "auto",
      },
    },
    { id: "morph-status-button" },
  );

  return (
    <LiveProps>
      <MorphStatusButton
        label={p.label}
        loadingLabel={p.loadingLabel}
        successLabel={p.successLabel}
        errorLabel={p.errorLabel}
        resetAfter={p.resetAfter}
        status={
          p.status === "auto"
            ? undefined
            : (p.status as "idle" | "loading" | "success" | "error")
        }
        onClick={() => new Promise((resolve) => setTimeout(resolve, 1200))}
      />
    </LiveProps>
  );
}