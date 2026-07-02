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

export const themeColors = {
  light: {
    background: "oklch(1 0 0)",
    foreground: "oklch(0.145 0 0)",
    muted: "oklch(0.97 0 0)",
    primary: "oklch(0.205 0 0)",
    primaryForeground: "oklch(0.985 0 0)",
    border: "oklch(0.922 0 0)",
    accent: "oklch(0.97 0 0)",
  },
  dark: {
    background: "oklch(0.145 0 0)",
    foreground: "oklch(0.985 0 0)",
    muted: "oklch(0.269 0 0)",
    primary: "oklch(0.922 0 0)",
    primaryForeground: "oklch(0.205 0 0)",
    border: "oklch(1 0 0 / 10%)",
    accent: "oklch(0.269 0 0)",
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