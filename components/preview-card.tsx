import type { ReactNode } from "react";

type PreviewCardProps = {
  title?: string;
  note?: string;
  children: ReactNode;
};

export function PreviewCard({
  title = "Preview",
  note = "Preview",
  children,
}: PreviewCardProps) {
  return (
    <div className="p-1 overflow-hidden rounded-md bg-neutral-100/60 dark:bg-neutral-900/60">
      <div className="flex items-center justify-between py-1 px-2">
        <p className="text-xs font-medium capitalize text-muted-foreground font-mono">
          {title}
        </p>
        <p className="text-xs text-muted-foreground font-mono">{note}</p>
      </div>
      <div className="flex items-center justify-center min-h-112 rounded border-border border bg-background">
        {children}
      </div>
    </div>
  );
}
