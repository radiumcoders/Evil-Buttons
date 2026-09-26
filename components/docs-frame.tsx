import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type DocsFrameProps = {
  /** Slim row rendered inside the outer shell, above the inner card. */
  header?: ReactNode;
  children: ReactNode;
  className?: string;
  innerClassName?: string;
};

/**
 * Double-bezel container shared by docs blocks: a tinted outer shell with an
 * optional header row, wrapping a bordered inner card that holds the content.
 */
export function DocsFrame({
  header,
  children,
  className,
  innerClassName,
}: DocsFrameProps) {
  return (
    <div
      className={cn(
        "mt-5 rounded-xl bg-muted/50 p-1 dark:bg-muted/25",
        className,
      )}
    >
      {header ? (
        <div className="flex h-9 items-center justify-between gap-3 pr-1 pl-2.5">
          {header}
        </div>
      ) : null}
      <div
        className={cn(
          "relative overflow-hidden rounded-lg border border-border bg-background",
          innerClassName,
        )}
      >
        {children}
      </div>
    </div>
  );
}
