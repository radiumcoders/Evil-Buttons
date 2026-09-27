"use client";

import { useDialKit } from "dialkit";
import { DemonicButton } from "@/components/evil-buttons/demonic-button";
import ChromeButton, {
  type ChromeTone,
} from "@/components/evil-buttons/chrome-button";
import MinimalButton from "@/components/evil-buttons/minimal";
import MoviePassButton, {
  type MoviePassVariant,
} from "@/components/evil-buttons/movie-pass";
import ShinyButton from "@/components/evil-buttons/shiny-button";
import StickyButton from "@/components/evil-buttons/sticky";
import { ThreeDButton } from "@/components/evil-buttons/3d-button";
import TrollButton from "@/components/evil-buttons/troll-button";
import { MinecraftButton } from "@/components/evil-buttons/minecraft-button";
import { DeferredWebGLPreview } from "./shared";
import { LiveProps } from "./live-props";

export function DemonicButtonPreview() {
  const p = useDialKit(
    "DemonicButton",
    { label: "Corrupt the World", holdDuration: [2200, 500, 6000] },
    { id: "demonic-button" },
  );

  return (
    <LiveProps>
      <DemonicButton label={p.label} holdDuration={p.holdDuration} />
    </LiveProps>
  );
}

export function ChromeButtonPreview() {
  const p = useDialKit(
    "ChromeButton",
    {
      label: "Chromy",
      tone: { type: "select", options: ["silver", "black"], default: "silver" },
      speed: [1, 0.2, 3],
      interactive: true,
    },
    { id: "chrome-button" },
  );

  return (
    <DeferredWebGLPreview label={p.label}>
      <LiveProps>
        <ChromeButton
          tone={p.tone as ChromeTone}
          speed={p.speed}
          interactive={p.interactive}
        >
          {p.label}
        </ChromeButton>
      </LiveProps>
    </DeferredWebGLPreview>
  );
}


export function MinimalButtonPreview() {
  const p = useDialKit(
    "MinimalButton",
    { label: "Apply", arrow: true },
    { id: "minimal" },
  );

  return (
    <LiveProps>
      <MinimalButton arrow={p.arrow}>{p.label}</MinimalButton>
    </LiveProps>
  );
}

export function MoviePassButtonPreview() {
  const p = useDialKit(
    "MoviePassButton",
    {
      label: "Admit One",
      variant: {
        type: "select",
        options: ["tilt", "snap"],
        default: "tilt",
      },
      stub: { type: "text", default: "", placeholder: "NO. 01" },
      autoReset: true,
      resetDelay: [1800, 300, 5000],
    },
    { id: "movie-pass" },
  );

  return (
    <LiveProps>
      <MoviePassButton
        variant={p.variant as MoviePassVariant}
        stub={p.stub.trim() ? p.stub : undefined}
        resetDelay={p.autoReset ? p.resetDelay : null}
      >
        {p.label}
      </MoviePassButton>
    </LiveProps>
  );
}

export function ShinyButtonPreview() {
  const p = useDialKit(
    "ShinyButton",
    { label: "Search", shineDuration: [650, 200, 2000] },
    { id: "shiny-button" },
  );

  return (
    <LiveProps>
      <ShinyButton shineDuration={p.shineDuration}>{p.label}</ShinyButton>
    </LiveProps>
  );
}

export function StickyButtonPreview() {
  const p = useDialKit(
    "StickyButton",
    {
      label: "Try to Click",
      radius: [120, 0, 300],
      strength: [0.45, 0, 1],
      parallax: [0.35, 0, 1],
      tilt: [8, 0, 20],
    },
    { id: "sticky" },
  );

  return (
    <LiveProps>
      <StickyButton
        radius={p.radius}
        strength={p.strength}
        parallax={p.parallax}
        tilt={p.tilt}
      >
        {p.label}
      </StickyButton>
    </LiveProps>
  );
}

export function ThreeDButtonPreview() {
  const p = useDialKit(
    "ThreeDButton",
    { label: "Continue" },
    { id: "3d-button" },
  );

  return (
    <LiveProps>
      <ThreeDButton>{p.label}</ThreeDButton>
    </LiveProps>
  );
}

export function TrollButtonPreview() {
  const p = useDialKit(
    "TrollButton",
    {
      label: "Click Me",
      surrenderLabel: "Fine, click me",
      giveUpAfter: [3500, 1000, 10000],
      fleeRadius: [56, 16, 160],
      range: [140, 40, 300],
      resetAfter: [1500, 0, 5000],
    },
    { id: "troll-button" },
  );

  return (
    <LiveProps>
      <TrollButton
        surrenderLabel={p.surrenderLabel}
        giveUpAfter={p.giveUpAfter}
        fleeRadius={p.fleeRadius}
        range={p.range}
        resetAfter={p.resetAfter}
      >
        {p.label}
      </TrollButton>
    </LiveProps>
  );
}

export function MinecraftButtonPreview() {
  const p = useDialKit(
    "MinecraftButton",
    {
      label: "Singleplayer",
      tapsPerStage: [5, 1, 10],
      stages: [4, 2, 8],
      sound: true,
    },
    { id: "minecraft-button" },
  );

  return (
    <LiveProps>
      <MinecraftButton
        tapsPerStage={p.tapsPerStage}
        stages={p.stages}
        sound={p.sound}
      >
        {p.label}
      </MinecraftButton>
    </LiveProps>
  );
}
