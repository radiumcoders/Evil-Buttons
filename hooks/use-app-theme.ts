"use client";

import { useSyncExternalStore } from "react";

export type AppTheme = "light" | "dark";

function getThemeSnapshot(): AppTheme {
  if (typeof document === "undefined") return "light";
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

function subscribeToTheme(onStoreChange: () => void) {
  if (typeof document === "undefined") return () => undefined;

  const observer = new MutationObserver(onStoreChange);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class"],
  });

  return () => observer.disconnect();
}

export function useAppTheme(): AppTheme {
  return useSyncExternalStore(subscribeToTheme, getThemeSnapshot, () => "light");
}

export function useIsDarkMode() {
  return useAppTheme() === "dark";
}