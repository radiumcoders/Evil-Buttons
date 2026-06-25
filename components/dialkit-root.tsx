"use client";

import { DialRoot } from "dialkit";

export function DialKitRoot() {
  return (
    <DialRoot
      position="top-right"
      defaultOpen
      theme="system"
      productionEnabled
    />
  );
}
