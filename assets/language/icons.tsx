import type { ReactNode } from "react";

export function getIconForLanguageExtension(language: string): ReactNode {
  const key = language.toLowerCase();

  if (["ts", "tsx", "js", "jsx"].includes(key)) return "JS";
  if (["bash", "sh", "zsh", "shell"].includes(key)) return ">_";
  if (["json", "yaml", "yml", "toml"].includes(key)) return "{}";
  if (["css", "scss"].includes(key)) return "#";

  return "[]";
}
