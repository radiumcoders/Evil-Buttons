"use client";

import { useDialKit } from "dialkit";
import { DemonicButton } from "@/components/evil-buttons/demonic-button";
import ChromeButton from "@/components/evil-buttons/chrome-button";
import GridButton from "@/components/evil-buttons/grid-button";
import MinimalButton from "@/components/evil-buttons/minimal";
import MoviePassButton from "@/components/evil-buttons/movie-pass";
import ShinyButton from "@/components/evil-buttons/shiny-button";
import StickyButton from "@/components/evil-buttons/sticky";
import { ThreeDButton } from "@/components/evil-buttons/3d-button";
import TrollButton from "@/components/evil-buttons/troll-button";
import { DeferredWebGLPreview } from "./shared";

export function DemonicButtonPreview() {
  const p = useDialKit(
    "DemonicButton",
    { label: "Currupt the World" },
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
    { label: "Deploy Doom" },
    { id: "movie-pass" },
  );

  return <MoviePassButton>{p.label}</MoviePassButton>;
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
    { label: "Try to Click" },
    { id: "sticky" },
  );

  return <StickyButton>{p.label}</StickyButton>;
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
    { label: "Click Me" },
    { id: "troll-button" },
  );

  return <TrollButton>{p.label}</TrollButton>;
}