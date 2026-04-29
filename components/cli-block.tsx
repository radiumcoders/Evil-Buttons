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

const managers: PackageManager[] = ["npm", "yarn", "bun", "pnpm"];

const managerMeta: Record<
  PackageManager,
  {
    icon: typeof NpmIcon;
    activeTextClassName: string;
    activeIndicatorClassName: string;
  }
> = {
  npm: {
    icon: NpmIcon,
    activeTextClassName: "text-[#C3292F]",
    activeIndicatorClassName: "bg-[#C3292F]",
  },
  yarn: {
    icon: YarnIcon,
    activeTextClassName: "text-[#3592BD]",
    activeIndicatorClassName: "bg-[#3592BD]",
  },
  bun: {
    icon: BunIcon,
    activeTextClassName: "text-foreground",
    activeIndicatorClassName: "bg-foreground",
  },
  pnpm: {
    icon: PnpmIcon,
    activeTextClassName: "text-[#FAAF18]",
    activeIndicatorClassName: "bg-[#FAAF18]",
  },
};

export function CliBlock({ commands }: { commands: string[] }) {
  const { packageManager, setConfig } = useConfig();
  const value = `${packageCommands[packageManager]} ${commands.join(" ")}`.trim();

  return (
    <div className="group mt-2 flex flex-col rounded-[8px] bg-[#F5F5F5] p-1 dark:bg-neutral-900/60">
      <div className="flex flex-row items-center justify-between gap-2 pr-1 pl-2">
        <div className="flex items-center gap-0.5">
          {managers.map((manager) => {
            const { icon: Icon, activeIndicatorClassName, activeTextClassName } =
              managerMeta[manager];

            return (
              <button
                key={manager}
                type="button"
                onClick={() => setConfig({ packageManager: manager })}
                className={cn(
                  "relative flex h-8 items-center gap-2 px-2 text-xs font-medium capitalize text-muted-foreground transition hover:text-foreground",
                  manager === packageManager && activeTextClassName,
                )}
              >
                <span
                  className={cn(
                    "absolute inset-x-1 bottom-0 h-0.5 rounded-full bg-transparent transition-colors",
                    manager === packageManager && activeIndicatorClassName,
                  )}
                  aria-hidden="true"
                />
                <Icon className="size-3" />
                <span>{manager}</span>
              </button>
            );
          })}
        </div>
        <CopyButton className="-mt-0.5" code={value} />
      </div>
      <div className="rounded-[5px] border bg-background p-3 text-[13px] text-muted-foreground">
        <pre className="overflow-x-auto">
          <code className="font-mono">{value}</code>
        </pre>
      </div>
    </div>
  );
}
