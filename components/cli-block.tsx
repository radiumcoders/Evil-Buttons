"use client";

import { BunIcon, NpmIcon, PnpmIcon, YarnIcon } from "@/assets/icons";
import { useConfig, type PackageManager } from "@/hooks/use-config";
import CopyButton from "@/components/copy-button";
import { cn } from "@/lib/utils";

const packageCommands: Record<PackageManager, string> = {
  npm: "npx shadcn@latest add",
  yarn: "yarn shadcn@latest add",
  bun: "bunx --bun shadcn@latest add",
  pnpm: "pnpm dlx shadcn@latest add",
};

const managers: PackageManager[] = ["pnpm", "npm", "yarn", "bun"];

const managerMeta: Record<
  PackageManager,
  {
    icon: typeof NpmIcon;
    activeTextClassName: string;
  }
> = {
  npm: {
    icon: NpmIcon,
    activeTextClassName: "text-[#C3292F]",
  },
  yarn: {
    icon: YarnIcon,
    activeTextClassName: "text-[#3592BD]",
  },
  bun: {
    icon: BunIcon,
    activeTextClassName: "text-foreground",
  },
  pnpm: {
    icon: PnpmIcon,
    activeTextClassName: "text-[#FAAF18]",
  },
};

export function CliBlock({ commands }: { commands: string[] }) {
  const { packageManager, setConfig } = useConfig();
  const value = `${packageCommands[packageManager]} ${commands.join(" ")}`.trim();

  return (
    <div className="group mt-4 overflow-hidden border border-border bg-background">
      <div className="flex flex-row items-center justify-between gap-2 px-3 pt-2.5 pb-2">
        <div className="flex min-w-0 items-center gap-1 overflow-x-auto">
          {managers.map((manager) => {
            const { icon: Icon, activeTextClassName } = managerMeta[manager];

            return (
              <button
                key={manager}
                type="button"
                onClick={() => setConfig({ packageManager: manager })}
                className={cn(
                  "flex h-8 shrink-0 items-center gap-2 px-2.5 text-xs font-semibold text-muted-foreground transition hover:text-foreground",
                  manager === packageManager && activeTextClassName,
                )}
              >
                <Icon className="size-3" />
                <span>{manager}</span>
              </button>
            );
          })}
        </div>
        <CopyButton className="shrink-0" code={value} />
      </div>
      <div className="bg-background px-4 pb-4 pt-2 text-[13px] text-foreground">
        <pre className="overflow-x-auto">
          <code className="font-mono">{value}</code>
        </pre>
      </div>
    </div>
  );
}
