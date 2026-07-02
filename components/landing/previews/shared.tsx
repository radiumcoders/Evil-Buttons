"use client";

import { DeferredMount } from "@/components/landing/deferred-mount";
import type { ReactNode } from "react";

export function WebGLPlaceholder({ label }: { label: string }) {
  return (
    <span className="inline-flex min-h-16 min-w-52 items-center justify-center border border-border bg-muted px-9 py-4 font-mono text-sm font-medium uppercase tracking-widest text-muted-foreground">
      {label}
    </span>
  );
}

export function DeferredWebGLPreview({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <DeferredMount placeholder={<WebGLPlaceholder label={label} />}>
      {children}
    </DeferredMount>
  );
}