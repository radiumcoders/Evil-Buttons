"use client";

import { AquaButton, type AquaButtonVariant } from "@/components/evil-buttons/aqua-button";
import { FrameButton } from "@/components/evil-buttons/frame-button";
import { HighlightButton } from "@/components/evil-buttons/highlight-button";
import MoviePassButton, {
  type MoviePassVariant,
} from "@/components/evil-buttons/movie-pass";
import {
  RevealButton,
  type RevealButtonVariant,
} from "@/components/evil-buttons/reveal-button";
import {
  SlideToDetonate,
  type SlideToDetonateVariant,
} from "@/components/evil-buttons/slide-to-detonate";
import { ButtonPreview } from "@/components/landing/previews";

type OutlineVariant = "default" | "secondary" | "outline";

/**
 * Landing-card preview: the static docs preview, re-rendered with the picked
 * `variant` for the components that have one.
 */
export function ShowcasePreview({
  registryName,
  variant,
}: {
  registryName: string;
  variant?: string;
}) {
  switch (registryName) {
    case "reveal-button":
      return (
        <RevealButton
          label="Reveal"
          hiddenLabel="Hidden"
          maskedValue="•••• •••• ••••"
          secret="sk_live_••••_9xQ4"
          revealMode="hold"
          variant={variant as RevealButtonVariant}
        />
      );
    case "aqua-button":
      return (
        <AquaButton variant={variant as AquaButtonVariant}>Deploy Doom</AquaButton>
      );
    case "frame-button":
      return <FrameButton variant={variant as OutlineVariant}>Deploy</FrameButton>;
    case "highlight-button":
      return (
        <HighlightButton variant={variant as OutlineVariant}>Send</HighlightButton>
      );
    case "movie-pass":
      return (
        <MoviePassButton variant={variant as MoviePassVariant}>
          Admit One
        </MoviePassButton>
      );
    case "slide-to-detonate":
      return (
        <SlideToDetonate
          label="Slide to detonate"
          threshold={0.9}
          resistance={0.35}
          smoothness={0.4}
          resetAfter={1600}
          variant={variant as SlideToDetonateVariant}
        />
      );
    default:
      return <ButtonPreview registryName={registryName} />;
  }
}
