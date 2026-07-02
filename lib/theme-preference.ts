export const THEME_STORAGE_KEY = "theme";

export type ThemePreference = "light" | "dark";

export function readPreferredTheme(): ThemePreference {
  if (typeof window === "undefined") return "light";

  const stored = localStorage.getItem(THEME_STORAGE_KEY);
  if (stored === "dark" || stored === "light") return stored;

  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

export function applyTheme(theme: ThemePreference) {
  document.documentElement.classList.toggle("dark", theme === "dark");
}

export function toggleTheme() {
  const nextTheme: ThemePreference =
    document.documentElement.classList.contains("dark") ? "light" : "dark";

  applyTheme(nextTheme);
  localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
}