import { CliBlock } from "@/components/cli-block";
import { ClickPowerUp } from "@/components/evil-buttons/click-powerup";
import MinimalButton from "@/components/evil-buttons/minimal";
import StickyButton from "@/components/evil-buttons/sticky";
import { PreviewCard } from "@/components/preview-card";
import type { MDXComponents } from "mdx/types";
import { isValidElement, type ReactNode } from "react";
import MoviePassButton from "./evil-buttons/movie-pass";
import ShinyButton from "./evil-buttons/shiny-button";
import GridButton from "./evil-buttons/grid-button";
import DitherButton from "./evil-buttons/dither-button";
import EvilEyeButton from "./evil-buttons/evil-eye-button";
import TrollButton from "./evil-buttons/troll-button";
import ChromeButton from "./evil-buttons/chrome-button";
import { BrutalButton } from "./evil-buttons/brutal-button";
import { AquaButton } from "./evil-buttons/aqua-button";
import { ThreeDButton } from "./evil-buttons/3d-button";
import { FrameButton } from "./evil-buttons/frame-button";
import { HighlightButton } from "./evil-buttons/highlight-button";
import { GlitchButton } from "./evil-buttons/glitch-button";
import { CommandButton } from "./evil-buttons/command-button";
import { CopyButton } from "./evil-buttons/copy-button";
import { RevealButton } from "./evil-buttons/reveal-button";
import {DemonicButton} from "./evil-buttons/demonic-button";
import { HoldButton } from "./evil-buttons/hold-button";
import { CaptchaButton } from "./evil-buttons/captcha-button";
import { DoubtButton } from "./evil-buttons/doubt-button";
import { SlideToDetonate } from "./evil-buttons/slide-to-detonate";

type CmdProps = {
  children: ReactNode;
};

type LinkProps = {
  children: ReactNode;
  href: string;
  _blank?: boolean;
};

function extractText(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") {
    return String(node);
  }

  if (Array.isArray(node)) {
    return node.map((child) => extractText(child)).join("");
  }

  if (isValidElement<{ children?: ReactNode }>(node)) {
    return extractText(node.props.children);
  }

  return "";
}

function Cmd({ children }: CmdProps) {
  const commands = extractText(children)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  return <CliBlock commands={commands} />;
}

function Link({ children, href, _blank }: LinkProps) {
  if (_blank) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="font-medium text-foreground underline decoration-border underline-offset-4 transition-colors hover:text-primary"
      >
        {children}
      </a>
    );
  }
  return (
    <a
      href={href}
      className="font-medium text-foreground underline decoration-border underline-offset-4 transition-colors hover:text-primary"
    >
      {children}
    </a>
  );
}

export function getCustomMDXComponents(): MDXComponents {
  return {
    PreviewCard,
    Cmd,
    ClickPowerUp,
    StickyButton,
    ShinyButton,
    MoviePassButton,
    MinimalButton,
    EvilButton: ClickPowerUp,
    GridButton,
    DitherButton,
    EvilEyeButton,
    Link,
    TrollButton,
    ChromeButton,
    BrutalButton,
    AquaButton,
    ThreeDButton,
    FrameButton,
    HighlightButton,
    GlitchButton,
    CommandButton,
    CopyButton,
    RevealButton,
    DemonicButton,
    HoldButton,
    CaptchaButton,
    DoubtButton,
    SlideToDetonate,
  };
}
