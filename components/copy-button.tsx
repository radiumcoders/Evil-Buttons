"use client";

import { CheckIcon, CopyIcon } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import type { EventProperties } from "tracwell";
import { trackOutcome } from "@/lib/tracwell";
import { cn } from "@/lib/utils";

type CopyButtonProps = {
  code: string;
  className?: string;
  withBlurBg?: boolean;
  outcome?: {
    name: string;
    properties?: EventProperties;
  };
};

export default function CopyButton({
  code,
  className,
  withBlurBg,
  outcome,
}: CopyButtonProps) {
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
    try {
      await navigator.clipboard.writeText(code);
    } catch {
      return;
    }

    setCopied(true);
    if (outcome) {
      trackOutcome(outcome.name, outcome.properties);
    }

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
        "inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        copied && "text-foreground",
        withBlurBg && "bg-background/80 shadow-sm backdrop-blur",
        className,
      )}
      aria-label={copied ? "Copied" : "Copy code"}
      title={copied ? "Copied" : "Copy code"}
    >
      <Icon size={14} weight={copied ? "bold" : "regular"} />
    </button>
  );
}
