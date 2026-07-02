"use client";

import { DialRoot } from "dialkit";
import { useAppTheme } from "@/hooks/use-app-theme";

export function AppDialRoot() {
  const theme = useAppTheme();

  return <DialRoot theme={theme} position="top-left" />;
}