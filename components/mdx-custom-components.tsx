import type { MDXComponents } from "mdx/types";
import { isValidElement, type ReactNode } from "react";
import { PreviewCard } from "@/components/preview-card";
import { CliBlock } from "@/components/cli-block";
import { CodeBlock } from "@/components/code-block";
import { ClickPowerUp } from "@/components/evil-buttons/click-powerup";

type CmdProps = {
  children: ReactNode;
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

export function getCustomMDXComponents(): MDXComponents {
  return {
    PreviewCard,
    Cmd,
    CodeBlock,
    ClickPowerUp,
    EvilButton: ClickPowerUp,
  };
}
