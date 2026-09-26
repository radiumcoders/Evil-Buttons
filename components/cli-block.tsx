"use client";

import { BunIcon, NpmIcon, PnpmIcon, YarnIcon } from "@/assets/icons";
import { useConfig, type PackageManager } from "@/hooks/use-config";
import CopyButton from "@/components/copy-button";
import { DocsFrame } from "@/components/docs-frame";
import { cn } from "@/lib/utils";

export const packageCommands: Record<PackageManager, string> = {
  npm: "npx shadcn@latest add",
  yarn: "yarn shadcn@latest add",
  bun: "bunx --bun shadcn@latest add",
  pnpm: "pnpm dlx shadcn@latest add",
};

const managers: PackageManager[] = ["pnpm", "npm", "yarn", "bun"];

const managerMeta: Record<
  PackageManager,
  { icon: typeof NpmIcon; activeClassName: string }
> = {
  npm: { icon: NpmIcon, activeClassName: "text-[#C3292F]" },
  yarn: { icon: YarnIcon, activeClassName: "text-[#3592BD]" },
  bun: { icon: BunIcon, activeClassName: "text-foreground" },
  pnpm: { icon: PnpmIcon, activeClassName: "text-[#F69220]" },
};

export function PackageManagerTabs({
  value,
  onChange,
  className,
}: {
  value: PackageManager;
  onChange: (manager: PackageManager) => void;
  className?: string;
}) {
  return (
    <div
      role="tablist"
      aria-label="Package manager"
      className={cn(
        "docs-scroll flex min-w-0 items-center overflow-x-auto",
        className,
      )}
    >
      {managers.map((manager) => {
        const { icon: Icon, activeClassName } = managerMeta[manager];
        const active = manager === value;

        return (
          <button
            key={manager}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(manager)}
            className={cn(
              "flex h-7 shrink-0 items-center gap-1.5 rounded-md px-1.5 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              active
                ? activeClassName
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="size-3.5" />
            <span>{manager}</span>
          </button>
        );
      })}
    </div>
  );
}

export function CliBlock({ commands }: { commands: string[] }) {
  const { packageManager, setConfig } = useConfig();
  const value = `${packageCommands[packageManager]} ${commands.join(" ")}`.trim();

  return (
    <DocsFrame
      header={
        <>
          <PackageManagerTabs
            value={packageManager}
            onChange={(manager) => setConfig({ packageManager: manager })}
            className="-ml-1.5"
          />
          <CopyButton
            className="shrink-0"
            code={value}
            outcome={{
              name: "install_command_copied",
              properties: {
                source: "docs_cli",
                package_manager: packageManager,
                registry_items: commands,
              },
            }}
          />
        </>
      }
    >
      <pre className="docs-scroll overflow-x-auto px-4 py-3.5 text-[13px] leading-6">
        <code className="font-mono text-foreground/85">{value}</code>
      </pre>
    </DocsFrame>
  );
}
