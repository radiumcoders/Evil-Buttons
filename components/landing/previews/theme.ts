"use client";

import { useDialKit, type DialConfig, type UseDialOptions } from "dialkit";
import { useIsDarkMode } from "@/hooks/use-app-theme";

export function useThemedDialKit<T extends DialConfig>(
  name: string,
  getConfig: (isDark: boolean) => T,
  options?: UseDialOptions,
) {
  const isDark = useIsDarkMode();
  return useDialKit(name, getConfig(isDark), options);
}

// DialKit color controls require #RRGGBB hex — oklch() breaks the native picker.
export const themeColors = {
  light: {
    background: "#ffffff",
    foreground: "#1a1a1a",
    muted: "#f5f5f5",
    primary: "#1a1a1a",
    primaryForeground: "#fafafa",
    border: "#e5e5e5",
    accent: "#f5f5f5",
  },
  dark: {
    background: "#1a1a1a",
    foreground: "#fafafa",
    muted: "#404040",
    primary: "#e5e5e5",
    primaryForeground: "#1a1a1a",
    border: "#333333",
    accent: "#404040",
  },
} as const;

export function pillClassNames(isDark: boolean) {
  return isDark
    ? {
        primaryClassName: "bg-neutral-950 text-neutral-200",
        secondaryClassName: "bg-primary text-primary-foreground",
      }
    : {
        primaryClassName: "bg-muted text-foreground",
        secondaryClassName: "bg-primary text-primary-foreground",
      };
}