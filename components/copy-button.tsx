"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

type CopyButtonProps = {
  code: string;
  className?: string;
  withBlurBg?: boolean;
};

export default function CopyButton({ code, className, withBlurBg }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  async function onCopy() {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  return (
    <button
      type="button"
      onClick={onCopy}
      className={cn(
        "rounded px-2 py-1 text-xs font-medium text-muted-foreground transition hover:text-foreground",
        withBlurBg && "bg-background/80 backdrop-blur",
        className,
      )}
      aria-label="Copy code"
    >
      {copied ? "Copied" : "Copy"}
    </button>
  );
}
