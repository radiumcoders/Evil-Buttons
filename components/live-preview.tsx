"use client";

import { ArrowCounterClockwise, Check, Copy } from "@phosphor-icons/react";
import { DialRoot, DialStore } from "dialkit";
import "dialkit/styles.css";
import { useCallback, useRef, useState, type ReactNode } from "react";
import { DocsFrame } from "@/components/docs-frame";
import { ButtonPreview, hasDialPreview } from "@/components/landing/previews";
import {
  LivePropsProvider,
  toJsx,
} from "@/components/landing/previews/live-props";
import { useAppTheme } from "@/hooks/use-app-theme";
import { cn } from "@/lib/utils";

export type LiveSource = {
  registryName: string;
  installCommand: string;
  /** The component import from the page's Usage snippet. */
  importLine: string;
  docsUrl: string;
};

type LivePreviewProps = {
  source: LiveSource;
  /** Rendered instead when the item has no dial-backed preview. */
  fallback: ReactNode;
};

function componentName(importLine: string) {
  return importLine.match(/^import\s+(?:\{\s*)?(\w+)/)?.[1] ?? "Button";
}

function buildPrompt(source: LiveSource, props: Record<string, unknown>) {
  const name = componentName(source.importLine);

  return `Add the Evil Buttons ${name} component to this project, configured exactly as below.

1. Install it with the shadcn CLI:

${source.installCommand}

2. Import it where it is needed:

${source.importLine}

3. Render it with these props:

${toJsx(name, props)}

Keep every prop value as listed. Wire any event callbacks (onClick, onConfirm, and so on) to the real action at the call site. Docs: ${source.docsUrl}
`;
}

const toolbarButton =
  "inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-md px-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-brand/10 hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50";

/**
 * Docs preview wired to DialKit: the button on top, its props as live
 * controls underneath, with reset and copy-as-agent-prompt actions.
 * Remounts on theme change so theme-aware defaults (colors) reset to the
 * matching palette.
 */
export function LivePreview({ source, fallback }: LivePreviewProps) {
  const theme = useAppTheme();
  const propsRef = useRef<Record<string, unknown>>({});
  const [copied, setCopied] = useState(false);
  const copiedTimeout = useRef<number | undefined>(undefined);

  const report = useCallback((props: Record<string, unknown>) => {
    propsRef.current = props;
  }, []);

  const reset = () => {
    for (const panel of DialStore.getPanels("panel")) {
      DialStore.resetValues(panel.id);
    }
  };

  const copyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(
        buildPrompt(source, propsRef.current),
      );
    } catch {
      return;
    }
    setCopied(true);
    window.clearTimeout(copiedTimeout.current);
    copiedTimeout.current = window.setTimeout(() => setCopied(false), 1500);
  };

  if (!hasDialPreview(source.registryName)) {
    return (
      <DocsFrame innerClassName="flex min-h-104 items-center justify-center px-6 py-10">
        {fallback}
      </DocsFrame>
    );
  }

  return (
    <DocsFrame key={theme} innerClassName="flex flex-col">
      <div className="flex min-h-104 items-center justify-center px-6 py-10">
        <LivePropsProvider value={report}>
          <ButtonPreview registryName={source.registryName} dial />
        </LivePropsProvider>
      </div>
      <div className="border-t border-border">
        <div className="flex items-center justify-between gap-3 px-4 pt-3">
          <p className="text-xs font-medium text-muted-foreground">Props</p>
          <div className="flex items-center gap-1">
            <button type="button" onClick={reset} className={toolbarButton}>
              <ArrowCounterClockwise className="size-3.5" />
              Reset
            </button>
            <button
              type="button"
              onClick={copyPrompt}
              className={cn(toolbarButton, copied && "bg-brand/10 text-brand")}
              title="Copy a prompt with the install command and this config"
            >
              {copied ? (
                <Check className="size-3.5" />
              ) : (
                <Copy className="size-3.5" />
              )}
              {copied ? "Copied" : "Copy prompt"}
            </button>
          </div>
        </div>
        <DialRoot mode="inline" theme={theme} productionEnabled />
      </div>
    </DocsFrame>
  );
}
