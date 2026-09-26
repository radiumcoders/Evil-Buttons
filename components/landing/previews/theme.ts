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
/**
 * DialKit has no list control, so array props become a folder of numbered
 * fields (`item1`, `item2`, …). Clearing a text field drops it from the list.
 */
export function listFolder<T extends string>(items: readonly T[]) {
  return Object.fromEntries(
    items.map((item, i) => [`item${i + 1}`, item]),
  ) as Record<string, T>;
}

export function colorFolder(colors: readonly string[]) {
  return Object.fromEntries(
    colors.map((color, i) => [`color${i + 1}`, { type: "color", default: color }]),
  ) as Record<string, { type: "color"; default: string }>;
}

export function fromFolder(folder: Record<string, unknown>) {
  return Object.values(folder).filter(
    (value): value is string => typeof value === "string" && value.trim() !== "",
  );
}
