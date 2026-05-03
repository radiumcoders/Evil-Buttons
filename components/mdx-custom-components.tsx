import type { MDXComponents } from "mdx/types";
import { isValidElement, type ReactNode } from "react";
import { PreviewCard } from "@/components/preview-card";
import { CliBlock } from "@/components/cli-block";
import { CodeBlock } from "@/components/code-block";
import { ClickPowerUp } from "@/components/evil-buttons/click-powerup";
import StickyButton from "@/components/evil-buttons/sticky";
import ShinyButton from "./evil-buttons/shiny-button";
import MoviePassButton from "./evil-buttons/movie-pass";
import MinimalButton from "@/components/evil-buttons/minimal";
import VercelLogo from "@/components/evil-buttons/logo/vercel";
import ShadcnLogo from "@/components/evil-buttons/logo/shadcn";
import TanStackLogo from "@/components/evil-buttons/logo/tanstack";
import { ScrollBars, ScrollBarsVertical } from "@/components/evil-buttons/scroll-bars";
import { useScroll, motion } from "motion";

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
    CodeBlock,
    ClickPowerUp,
    StickyButton,
    ShinyButton,
    MoviePassButton,
    MinimalButton,
    VercelLogo,
    ShadcnLogo,
    TanStackLogo,
    ScrollBarsPreview: () => {
      const { scrollYProgress } = useScroll();
      return <ScrollBars scrollYProgress={scrollYProgress} barCount={31} majorEvery={5} />;
    },
    ScrollBarsVerticalPreview: () => {
      const { scrollYProgress } = useScroll();
      return <ScrollBarsVertical scrollYProgress={scrollYProgress} barCount={31} majorEvery={5} />;
    },
    EvilButton: ClickPowerUp,
    Link,
  };
}
