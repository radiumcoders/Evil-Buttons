"use client";

import { DialRoot } from "dialkit";
import "dialkit/styles.css";
import type { ReactNode } from "react";
import { DocsFrame } from "@/components/docs-frame";
import { ButtonPreview, hasDialPreview } from "@/components/landing/previews";
import { useAppTheme } from "@/hooks/use-app-theme";

type LivePreviewProps = {
  registryName: string;
  /** Rendered instead when the item has no dial-backed preview. */
  fallback: ReactNode;
};

/**
 * Docs preview wired to DialKit: the button on top, its props as live
 * controls underneath. Remounts on theme change so theme-aware defaults
 * (colors) reset to the matching palette.
 */
export function LivePreview({ registryName, fallback }: LivePreviewProps) {
  const theme = useAppTheme();

  if (!hasDialPreview(registryName)) {
    return (
      <DocsFrame innerClassName="flex min-h-104 items-center justify-center px-6 py-10">
        {fallback}
      </DocsFrame>
    );
  }

  return (
    <DocsFrame key={theme} innerClassName="flex flex-col">
      <div className="flex min-h-104 items-center justify-center px-6 py-10">
        <ButtonPreview registryName={registryName} dial />
      </div>
      <div className="border-t border-border">
        <DialRoot mode="inline" theme={theme} productionEnabled />
      </div>
    </DocsFrame>
  );
}
