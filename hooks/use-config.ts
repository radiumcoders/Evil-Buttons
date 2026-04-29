"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

export type PackageManager = "npm" | "yarn" | "bun" | "pnpm";

type Config = {
  packageManager: PackageManager;
};

type StoredConfig = {
  version: 1;
  config: Config;
};

const STORAGE_KEY = "docs-config";
const CONFIG_STORAGE_VERSION = 1;
const PACKAGE_MANAGERS: readonly PackageManager[] = ["npm", "yarn", "bun", "pnpm"];
const DEFAULT_CONFIG: Config = { packageManager: "npm" };

function getInitialConfig(): Config {
  return DEFAULT_CONFIG;
}

function isPackageManager(value: unknown): value is PackageManager {
  return typeof value === "string" && PACKAGE_MANAGERS.includes(value as PackageManager);
}

function parseStoredConfig(raw: string): Config | null {
  const parsed = JSON.parse(raw) as Partial<StoredConfig> | Partial<Config>;

  if ("version" in parsed) {
    return parsed.version === CONFIG_STORAGE_VERSION &&
      isPackageManager(parsed.config?.packageManager)
      ? parsed.config
      : null;
  }

  const legacyConfig = parsed as Partial<Config>;

  return isPackageManager(legacyConfig.packageManager)
    ? { packageManager: legacyConfig.packageManager }
    : null;
}

function writeStoredConfig(config: Config) {
  const stored: StoredConfig = {
    version: CONFIG_STORAGE_VERSION,
    config,
  };

  localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
}

export function useConfig() {
  const [config, setConfigState] = useState<Config>(getInitialConfig);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;

      const parsed = parseStoredConfig(raw);
      if (parsed) {
        const rafId = window.requestAnimationFrame(() => {
          setConfigState((prev) => {
            if (prev.packageManager === parsed.packageManager) {
              return prev;
            }

            return parsed;
          });
        });

        return () => window.cancelAnimationFrame(rafId);
      }
    } catch {
      // Ignore invalid persisted data.
    }
  }, []);

  const setConfig = useCallback((next: Partial<Config>) => {
    setConfigState((prev) => {
      const merged = { ...prev, ...next };

      try {
        writeStoredConfig(merged);
      } catch {
        // Keep the in-memory preference even when storage is unavailable.
      }

      return merged;
    });
  }, []);

  return useMemo(
    () => ({ packageManager: config.packageManager, setConfig }),
    [config.packageManager, setConfig],
  );
}
