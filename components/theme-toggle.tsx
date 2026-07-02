"use client";

import { Moon, Sun } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { useAppTheme } from "@/hooks/use-app-theme";
import { toggleTheme } from "@/lib/theme-preference";

export function ThemeToggle() {
  const theme = useAppTheme();
  const isDark = theme === "dark";

  return (
    <Button
      type="button"
      variant="outline"
      size="icon-sm"
      className="shrink-0 rounded-none"
      onClick={toggleTheme}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
    >
      {isDark ? <Sun weight="bold" /> : <Moon weight="bold" />}
    </Button>
  );
}