"use client";

import { DialRoot } from "dialkit";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useIsMobile } from "@/hooks/use-is-mobile";

export function AppDialRoot() {
  const theme = useAppTheme();
  const isMobile = useIsMobile();

  return (
    <DialRoot
      theme={theme}
      position={isMobile ? "bottom-left" : "top-left"}
    />
  );
}