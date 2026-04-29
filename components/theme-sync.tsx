"use client";

import { useEffect } from "react";

const THEME_STORAGE_KEY = "theme";
const DARK_THEME = "dark";
const LIGHT_THEME = "light";
const EDITABLE_SELECTOR = "input, textarea, select, [contenteditable='true']";

function readPreferredTheme() {
  const stored = localStorage.getItem(THEME_STORAGE_KEY);

  if (stored === DARK_THEME || stored === LIGHT_THEME) {
    return stored;
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches ? DARK_THEME : LIGHT_THEME;
}

function applyTheme(theme: typeof DARK_THEME | typeof LIGHT_THEME) {
  document.documentElement.classList.toggle("dark", theme === DARK_THEME);
}

export function ThemeSync() {
  useEffect(() => {
    applyTheme(readPreferredTheme());

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== "d") {
        return;
      }

      if ((event.target as HTMLElement | null)?.closest(EDITABLE_SELECTOR)) {
        return;
      }

      event.preventDefault();

      const nextTheme = document.documentElement.classList.contains("dark")
        ? LIGHT_THEME
        : DARK_THEME;

      applyTheme(nextTheme);
      localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return null;
}
