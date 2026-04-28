import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function EvilButton({ className, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center rounded-md border border-border bg-foreground px-4 py-2 text-sm font-medium text-background transition-transform hover:-translate-y-0.5 hover:shadow-md",
        className,
      )}
      {...props}
    />
  );
}
