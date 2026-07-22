"use client";

import { useEffect, type ReactNode } from "react";
import {
  applyTheme,
  readPreferredTheme,
  toggleTheme,
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
 * registers a safe global `d` hotkey that toggles dark mode. The hotkey ignores
 * modifier combinations (so browser shortcuts like Ctrl/Cmd+D keep working),
 * IME composition, and typing in editable controls.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    applyTheme(readPreferredTheme());

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.isComposing) return;
      if (event.key.toLowerCase() !== "d") return;
      if (isEditableTarget(event.target)) return;

      event.preventDefault();
      toggleTheme();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return <>{children}</>;
}
