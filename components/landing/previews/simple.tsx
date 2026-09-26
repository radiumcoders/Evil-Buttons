"use client";

import { useDialKit } from "dialkit";
import { DemonicButton } from "@/components/evil-buttons/demonic-button";
import ChromeButton from "@/components/evil-buttons/chrome-button";
import GridButton from "@/components/evil-buttons/grid-button";
import MinimalButton from "@/components/evil-buttons/minimal";
import MoviePassButton, {
  type MoviePassVariant,
} from "@/components/evil-buttons/movie-pass";
import ShinyButton from "@/components/evil-buttons/shiny-button";
import StickyButton from "@/components/evil-buttons/sticky";
import { ThreeDButton } from "@/components/evil-buttons/3d-button";
import TrollButton from "@/components/evil-buttons/troll-button";
import { DontPressButton } from "@/components/evil-buttons/dont-press-button";
import { DeferredWebGLPreview } from "./shared";

export function DemonicButtonPreview() {
  const p = useDialKit(
    "DemonicButton",
    { label: "Corrupt the World" },
    { id: "demonic-button" },
  );

  return <DemonicButton label={p.label} />;
}

export function ChromeButtonPreview() {
  const p = useDialKit(
    "ChromeButton",
    { label: "Chromy" },
    { id: "chrome-button" },
  );

  return (
    <DeferredWebGLPreview label={p.label}>
      <ChromeButton>{p.label}</ChromeButton>
    </DeferredWebGLPreview>
  );
}

export function GridButtonPreview() {
  const p = useDialKit("GridButton", { label: "Click" }, { id: "grid-button" });

  return <GridButton>{p.label}</GridButton>;
}

export function MinimalButtonPreview() {
  const p = useDialKit("MinimalButton", { label: "Apply" }, { id: "minimal" });

  return <MinimalButton>{p.label}</MinimalButton>;
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
    },
    { id: "movie-pass" },
  );

  return (
    <MoviePassButton variant={p.variant as MoviePassVariant}>
      {p.label}
    </MoviePassButton>
  );
}

export function ShinyButtonPreview() {
  const p = useDialKit(
    "ShinyButton",
    { label: "Search" },
    { id: "shiny-button" },
  );

  return <ShinyButton>{p.label}</ShinyButton>;
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
    <StickyButton
      radius={p.radius}
      strength={p.strength}
      parallax={p.parallax}
      tilt={p.tilt}
    >
      {p.label}
    </StickyButton>
  );
}

export function ThreeDButtonPreview() {
  const p = useDialKit(
    "ThreeDButton",
    { label: "Continue" },
    { id: "3d-button" },
  );

  return <ThreeDButton>{p.label}</ThreeDButton>;
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
    },
    { id: "troll-button" },
  );

  return (
    <TrollButton
      surrenderLabel={p.surrenderLabel}
      giveUpAfter={p.giveUpAfter}
      fleeRadius={p.fleeRadius}
      range={p.range}
    >
      {p.label}
    </TrollButton>
  );
}

export function DontPressButtonPreview() {
  const p = useDialKit(
    "DontPressButton",
    { idleLabel: "Don't Press" },
    { id: "dont-press-button" },
  );

  return <DontPressButton idleLabel={p.idleLabel} />;
}