import type { ReactNode } from "react";
import { DocsFrame } from "@/components/docs-frame";
import { LivePreview } from "@/components/live-preview";

type PreviewCardProps = {
  /** Kept for existing MDX usage; no longer rendered. */
  title?: string;
  /** Kept for existing MDX usage; no longer rendered. */
  note?: string;
  /**
   * Swap the children for the page's dial-backed preview with live prop
   * controls below it. Needs `registryName`, which the docs page injects.
   */
  live?: boolean;
  registryName?: string;
  children: ReactNode;
};

export function PreviewCard({ live, registryName, children }: PreviewCardProps) {
  if (live && registryName) {
    return <LivePreview registryName={registryName} fallback={children} />;
  }

  return (
    <DocsFrame innerClassName="flex min-h-104 items-center justify-center px-6 py-10">
      {children}
    </DocsFrame>
  );
}
