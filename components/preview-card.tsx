import type { ReactNode } from "react";
import { DocsFrame } from "@/components/docs-frame";

type PreviewCardProps = {
  /** Kept for existing MDX usage; no longer rendered. */
  title?: string;
  /** Kept for existing MDX usage; no longer rendered. */
  note?: string;
  children: ReactNode;
};

export function PreviewCard({ children }: PreviewCardProps) {
  return (
    <DocsFrame innerClassName="flex min-h-104 items-center justify-center px-6 py-10">
      {children}
    </DocsFrame>
  );
}
