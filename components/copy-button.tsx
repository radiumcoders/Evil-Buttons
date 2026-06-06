"use client";

import { CheckIcon, CopyIcon } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

type CopyButtonProps = {
  code: string;
  className?: string;
  withBlurBg?: boolean;
};

export default function CopyButton({ code, className, withBlurBg }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);
  const resetTimerRef = useRef<number | null>(null);
  const Icon = copied ? CheckIcon : CopyIcon;

  useEffect(() => {
    return () => {
      if (resetTimerRef.current !== null) {
        window.clearTimeout(resetTimerRef.current);
      }
    };
  }, []);

  async function onCopy() {
    await navigator.clipboard.writeText(code);
    setCopied(true);

    if (resetTimerRef.current !== null) {
      window.clearTimeout(resetTimerRef.current);
    }

    resetTimerRef.current = window.setTimeout(() => {
      setCopied(false);
      resetTimerRef.current = null;
    }, 1500);
  }

  return (
    <button
      type="button"
      onClick={onCopy}
      className={cn(
        "inline-flex size-8 items-center justify-center text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        copied && "text-foreground",
        withBlurBg && "bg-background/80 shadow-sm backdrop-blur",
        className,
      )}
      aria-label={copied ? "Copied" : "Copy code"}
      title={copied ? "Copied" : "Copy code"}
    >
      <Icon size={15} weight={copied ? "bold" : "regular"} />
    </button>
  );
}
