"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

export type PackageManager = "npm" | "yarn" | "bun" | "pnpm";

type Config = {
  packageManager: PackageManager;
};

const STORAGE_KEY = "docs-config";

function getInitialConfig(): Config {
  return { packageManager: "npm" };
}

export function useConfig() {
  const [config, setConfigState] = useState<Config>(getInitialConfig);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;

      const parsed = JSON.parse(raw) as Partial<Config>;
      if (
        parsed.packageManager &&
        ["npm", "yarn", "bun", "pnpm"].includes(parsed.packageManager)
      ) {
        setConfigState((prev) => {
          if (prev.packageManager === parsed.packageManager) {
            return prev;
          }

          return { ...prev, packageManager: parsed.packageManager as PackageManager };
        });
      }
    } catch {
      // Ignore invalid persisted data.
    }
  }, []);

  const setConfig = useCallback((next: Partial<Config>) => {
    setConfigState((prev) => {
      const merged = { ...prev, ...next };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
      return merged;
    });
  }, []);

  return useMemo(
    () => ({ packageManager: config.packageManager, setConfig }),
    [config.packageManager, setConfig],
  );
}
