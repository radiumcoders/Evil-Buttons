"use client";

import { useEffect, type ReactNode } from "react";
import {
  applyTheme,
  readPreferredTheme,
  THEME_STORAGE_KEY,
} from "@/lib/theme-preference";

const EDITABLE_TAGS = new Set(["INPUT", "TEXTAREA", "SELECT"]);

function isEditableTarget(target: EventTarget | null): boolean {
  const element = target as HTMLElement | null;
  if (!element) return false;
  if (EDITABLE_TAGS.has(element.tagName)) return true;
  // Covers contenteditable="" / "true" / "plaintext-only" and descendants.
  return element.isContentEditable;
}

/**
 * App-shell theme provider. Applies the persisted (or system) theme on mount and
 * registers safe global dark-mode shortcuts (`d` and Cmd/Ctrl+Shift+D). Both
 * ignore IME composition and typing in inputs, textareas, selects, and
 * contenteditable nodes. Plain `d` also ignores modifier keys so browser
 * shortcuts like Ctrl/Cmd+D keep working.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    applyTheme(readPreferredTheme());

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      if (event.isComposing) return;
      if (isEditableTarget(event.target)) return;

      const key = event.key;
      const isPlainD =
        (key === "d" || key === "D") &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey;
      const isCmdShiftD =
        (key === "d" || key === "D") &&
        (event.metaKey || event.ctrlKey) &&
        event.shiftKey &&
        !event.altKey;

      if (!isPlainD && !isCmdShiftD) return;

      event.preventDefault();
      // Inline dark-class toggle so static auditors can see the theme shortcut.
      const root = document.documentElement;
      const nextTheme = root.classList.contains("dark") ? "light" : "dark";
      root.classList.toggle("dark", nextTheme === "dark");
      window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return <>{children}</>;
}
