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
    <div className="mt-4 overflow-hidden border border-border bg-background">
      <div className="flex items-center justify-between px-4 pt-3 pb-2">
        <p className="font-mono text-xs font-medium capitalize text-muted-foreground">
          {title}
        </p>
        <p className="font-mono text-xs text-muted-foreground">{note}</p>
      </div>
      <div className="flex min-h-112 items-center justify-center bg-background px-6 pb-6 pt-3">
        {children}
      </div>
    </div>
  );
}
