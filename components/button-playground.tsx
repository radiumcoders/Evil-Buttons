"use client";

import * as React from "react";
import { DialRoot, useDialKitController } from "dialkit";
import { ThreeDButton } from "@/components/evil-buttons/3d-button";
import AquaButton from "@/components/evil-buttons/aqua-button";
import { BrutalButton } from "@/components/evil-buttons/brutal-button";
import CaptchaButton from "@/components/evil-buttons/captcha-button";
import ChromeButton from "@/components/evil-buttons/chrome-button";
import { ClickPowerUp } from "@/components/evil-buttons/click-powerup";
import { CommandButton } from "@/components/evil-buttons/command-button";
import CooldownButton from "@/components/evil-buttons/cooldown-button";
import { CopyButton } from "@/components/evil-buttons/copy-button";
import { DemonicButton } from "@/components/evil-buttons/demonic-button";
import DitherButton from "@/components/evil-buttons/dither-button";
import DoubtButton from "@/components/evil-buttons/doubt-button";
import EvilEyeButton from "@/components/evil-buttons/evil-eye-button";
import { FrameButton } from "@/components/evil-buttons/frame-button";
import GlitchButton from "@/components/evil-buttons/glitch-button";
import GridButton from "@/components/evil-buttons/grid-button";
import { HighlightButton } from "@/components/evil-buttons/highlight-button";
import HoldButton from "@/components/evil-buttons/hold-button";
import MinimalButton from "@/components/evil-buttons/minimal";
import MorphStatusButton from "@/components/evil-buttons/morph-status-button";
import MoviePassButton from "@/components/evil-buttons/movie-pass";
import { RevealButton } from "@/components/evil-buttons/reveal-button";
import ShinyButton from "@/components/evil-buttons/shiny-button";
import SlideToDetonate from "@/components/evil-buttons/slide-to-detonate";
import StickyButton from "@/components/evil-buttons/sticky";
import TrollButton from "@/components/evil-buttons/troll-button";

type ButtonId =
  | "3d-button"
  | "aqua-button"
  | "brutal-button"
  | "captcha-button"
  | "chrome-button"
  | "click-powerup"
  | "command-button"
  | "cooldown-button"
  | "copy-button"
  | "demonic-button"
  | "dither-button"
  | "doubt-button"
  | "evil-eye-button"
  | "frame-button"
  | "glitch-button"
  | "grid-button"
  | "highlight-button"
  | "hold-button"
  | "minimal"
  | "morph-status-button"
  | "movie-pass"
  | "reveal-button"
  | "shiny-button"
  | "slide-to-detonate"
  | "sticky"
  | "troll-button";

type ButtonEntry = {
  id: ButtonId;
  title: string;
  render: (label: string) => React.ReactNode;
};

const buttonEntries = [
  {
    id: "3d-button",
    title: "ThreeDButton",
    render: (label) => <ThreeDButton>{label}</ThreeDButton>,
  },
  {
    id: "aqua-button",
    title: "AquaButton",
    render: (label) => <AquaButton>{label}</AquaButton>,
  },
  {
    id: "brutal-button",
    title: "BrutalButton",
    render: (label) => <BrutalButton>{label}</BrutalButton>,
  },
  {
    id: "captcha-button",
    title: "CaptchaButton",
    render: (label) => <CaptchaButton>{label}</CaptchaButton>,
  },
  {
    id: "chrome-button",
    title: "ChromeButton",
    render: (label) => <ChromeButton>{label}</ChromeButton>,
  },
  {
    id: "click-powerup",
    title: "ClickPowerUp",
    render: (label) => <ClickPowerUp>{label}</ClickPowerUp>,
  },
  {
    id: "command-button",
    title: "CommandButton",
    render: (label) => <CommandButton shortcut="mod+k">{label}</CommandButton>,
  },
  {
    id: "cooldown-button",
    title: "CooldownButton",
    render: (label) => <CooldownButton>{label}</CooldownButton>,
  },
  {
    id: "copy-button",
    title: "CopyButton",
    render: (label) => (
      <CopyButton value={label} copyLabel={label} copiedLabel="Copied" />
    ),
  },
  {
    id: "demonic-button",
    title: "DemonicButton",
    render: (label) => <DemonicButton label={label} />,
  },
  {
    id: "dither-button",
    title: "DitherButton",
    render: (label) => <DitherButton>{label}</DitherButton>,
  },
  {
    id: "doubt-button",
    title: "DoubtButton",
    render: (label) => <DoubtButton>{label}</DoubtButton>,
  },
  {
    id: "evil-eye-button",
    title: "EvilEyeButton",
    render: (label) => <EvilEyeButton>{label}</EvilEyeButton>,
  },
  {
    id: "frame-button",
    title: "FrameButton",
    render: (label) => <FrameButton>{label}</FrameButton>,
  },
  {
    id: "glitch-button",
    title: "GlitchButton",
    render: (label) => <GlitchButton>{label}</GlitchButton>,
  },
  {
    id: "grid-button",
    title: "GridButton",
    render: (label) => <GridButton>{label}</GridButton>,
  },
  {
    id: "highlight-button",
    title: "HighlightButton",
    render: (label) => <HighlightButton>{label}</HighlightButton>,
  },
  {
    id: "hold-button",
    title: "HoldButton",
    render: (label) => <HoldButton>{label}</HoldButton>,
  },
  {
    id: "minimal",
    title: "MinimalButton",
    render: (label) => <MinimalButton>{label}</MinimalButton>,
  },
  {
    id: "morph-status-button",
    title: "MorphStatusButton",
    render: (label) => (
      <MorphStatusButton
        onClick={() => new Promise((resolve) => setTimeout(resolve, 900))}
      >
        {label}
      </MorphStatusButton>
    ),
  },
  {
    id: "movie-pass",
    title: "MoviePassButton",
    render: (label) => <MoviePassButton>{label}</MoviePassButton>,
  },
  {
    id: "reveal-button",
    title: "RevealButton",
    render: (label) => (
      <RevealButton label={label} secret="ACCESS-GRANTED" revealMode="toggle" />
    ),
  },
  {
    id: "shiny-button",
    title: "ShinyButton",
    render: (label) => <ShinyButton>{label}</ShinyButton>,
  },
  {
    id: "slide-to-detonate",
    title: "SlideToDetonate",
    render: (label) => <SlideToDetonate>{label}</SlideToDetonate>,
  },
  {
    id: "sticky",
    title: "StickyButton",
    render: (label) => <StickyButton>{label}</StickyButton>,
  },
  {
    id: "troll-button",
    title: "TrollButton",
    render: (label) => <TrollButton>{label}</TrollButton>,
  },
] satisfies ButtonEntry[];

const buttonOptions = buttonEntries.map(({ id, title }) => ({
  value: id,
  label: title,
}));

const buttonMap = new Map(buttonEntries.map((entry) => [entry.id, entry]));

export function ButtonPlayground() {
  const [hydrated, setHydrated] = React.useState(false);

  React.useEffect(() => {
    setHydrated(true);
  }, []);

  const dial = useDialKitController(
    "Button Lab",
    {
      button: {
        type: "select",
        options: buttonOptions,
        default: "brutal-button",
      },
      label: {
        type: "text",
        default: "Do the thing",
        placeholder: "Button label",
      },
      buttonStyle: {
        surface: { type: "color", default: "#000000" },
        text: { type: "color", default: "#ffffff" },
        border: { type: "color", default: "#000000" },
        shadow: { type: "color", default: "#000000" },
        radius: [6, 0, 40, 1],
        paddingX: [24, 8, 64, 1],
        paddingY: [12, 6, 28, 1],
        borderWidth: [2, 0, 8, 1],
        shadowSize: [4, 0, 24, 1],
        scale: [1, 0.5, 2, 0.01],
        disabled: false,
      },
    },
    {
      id: "home-button-lab",
      persist: true,
    },
  );

  const selectedId = dial.values.button as ButtonId;
  const selected = buttonMap.get(selectedId) ?? buttonEntries[0];
  const label = dial.values.label.trim() || "Button";
  const skin = dial.values.buttonStyle;

  return (
    <main
      data-hydrated={hydrated}
      className="relative flex min-h-screen items-center justify-center overflow-hidden bg-white text-black dark:bg-black dark:text-white"
    >
      <div className="button-lab-skin" style={
        {
          "--button-lab-bg": skin.surface,
          "--button-lab-text": skin.text,
          "--button-lab-border": skin.border,
          "--button-lab-shadow": skin.shadow,
          "--button-lab-radius": `${skin.radius}px`,
          "--button-lab-px": `${skin.paddingX}px`,
          "--button-lab-py": `${skin.paddingY}px`,
          "--button-lab-border-width": `${skin.borderWidth}px`,
          "--button-lab-shadow-size": `${skin.shadowSize}px`,
          transform: `scale(${skin.scale})`,
          opacity: skin.disabled ? 0.48 : 1,
          pointerEvents: skin.disabled ? "none" : "auto",
        } as React.CSSProperties
      }>
        {selected.render(label)}
      </div>
      <DialRoot
        position="top-right"
        defaultOpen
        theme="system"
        productionEnabled
      />
    </main>
  );
}
