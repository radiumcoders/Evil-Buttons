"use client";

import { useEffect } from "react";
import {
  applyTheme,
  readPreferredTheme,
  THEME_STORAGE_KEY,
  toggleTheme,
  type ThemePreference,
} from "@/lib/theme-preference";

const EDITABLE_SELECTOR = "input, textarea, select, [contenteditable='true']";

export function ThemeSync() {
  useEffect(() => {
    applyTheme(readPreferredTheme());

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== "d") return;
      if ((event.target as HTMLElement | null)?.closest(EDITABLE_SELECTOR)) {
        return;
      }

      event.preventDefault();
      toggleTheme();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return null;
}

export { THEME_STORAGE_KEY, type ThemePreference };