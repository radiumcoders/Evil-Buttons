import * as React from "react";
import { CommandButton, type CommandButtonVariant } from "./command-button";

const settings = {
  label: "Save",
  shortcut: "mod+s",
  showShortcut: true,
  title: "Launch notes",
  variant: "auto",
};

const VARIANTS = ["auto", "dark", "light"];

export default function CommandButtonDemo(props: Partial<typeof settings>) {
  const s = { ...settings, ...props };
  const variant = (
    VARIANTS.includes(s.variant) ? s.variant : "auto"
  ) as CommandButtonVariant;
  const [saves, setSaves] = React.useState(0);
  const save = () => setSaves((n) => n + 1);

  return (
    <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-background p-4">
      <div className="w-full max-w-[460px] [zoom:1.3] lg:[zoom:1.75]">
        <div className="overflow-hidden rounded-2xl bg-muted/60 shadow-[0_1px_2px_rgb(0_0_0/0.04),0_16px_40px_-16px_rgb(0_0_0/0.14)]">
          <div className="flex items-center justify-between gap-4 px-5 py-4">
            <div className="min-w-0">
              <h2 className="truncate text-sm font-semibold text-foreground">
                {s.title}
              </h2>
              <p className="text-xs text-muted-foreground tabular-nums">
                {saves === 0
                  ? "Unsaved changes"
                  : `Saved${saves > 1 ? ` ×${saves}` : ""} just now`}
              </p>
            </div>
            <CommandButton
              shortcut={s.shortcut}
              showShortcut={s.showShortcut}
              onCommand={save}
              onClick={save}
              variant={variant}
              className="h-11 shrink-0 text-base"
            >
              {s.label}
            </CommandButton>
          </div>
          <div className="space-y-2.5 bg-background/70 px-5 pt-5 pb-7 text-sm leading-relaxed text-muted-foreground">
            <p className="text-foreground">Ship it Thursday.</p>
            <p>
              Docs are frozen, the changelog is drafted, and the banner goes
              live at nine. Anything else waits for the next train.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
