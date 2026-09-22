"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useIsMobile } from "@/hooks/use-is-mobile";
import Link from "next/link";
import { useState } from "react";

export function MobileConstructionNotice() {
  const isMobile = useIsMobile();
  const [dismissed, setDismissed] = useState(false);

  if (!isMobile) return null;

  return (
    <Dialog
      open={!dismissed}
      onOpenChange={(next) => {
        if (!next) setDismissed(true);
      }}
    >
      <DialogContent className="gap-5 rounded-none p-6">
        <DialogHeader className="pr-6">
          <DialogTitle className="font-doto text-lg font-black tracking-tight">
            Under construction
          </DialogTitle>
          <DialogDescription>
            The landing page is under construction on mobile. Please visit the
            docs for now.
          </DialogDescription>
        </DialogHeader>
        <Link
          href="/docs"
          className="inline-flex h-9 w-full items-center justify-center bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Visit docs
        </Link>
      </DialogContent>
    </Dialog>
  );
}
