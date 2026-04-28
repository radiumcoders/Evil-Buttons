import type { MDXComponents } from "mdx/types";
import { PreviewCard } from "@/components/preview-card";
import { EvilButton } from "@/components/evil-buttons/evil-button";
import { CliBlock } from "@/components/cli-block";
import { CodeBlock } from "@/components/code-block";

type CmdProps = {
  children: string;
};

function Cmd({ children }: CmdProps) {
  const commands = children
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  return <CliBlock commands={commands} />;
}

export function getCustomMDXComponents(): MDXComponents {
  return {
    PreviewCard,
    EvilButton,
    Cmd,
    CodeBlock,
  };
}
