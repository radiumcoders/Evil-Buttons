import type { ReactNode } from "react";
import { DocsFrame } from "@/components/docs-frame";
import { LivePreview, type LiveSource } from "@/components/live-preview";

type PreviewCardProps = {
  /** Kept for existing MDX usage; no longer rendered. */
  title?: string;
  /** Kept for existing MDX usage; no longer rendered. */
  note?: string;
  /**
   * Swap the children for the page's dial-backed preview with live prop
   * controls below it. Needs `source`, which the docs page injects.
   */
  live?: boolean;
  source?: LiveSource;
  children: ReactNode;
};

export function PreviewCard({ live, source, children }: PreviewCardProps) {
  if (live && source) {
    return <LivePreview source={source} fallback={children} />;
  }

  return (
    <DocsFrame innerClassName="flex min-h-104 items-center justify-center px-6 py-10">
      {children}
    </DocsFrame>
  );
}
