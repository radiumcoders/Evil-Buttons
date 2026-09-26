"use client";

import { useDialKit } from "dialkit";
import { useIsDarkMode } from "@/hooks/use-app-theme";
import { pillClassNames, useThemedDialKit } from "./theme";
import { CommandButton } from "@/components/evil-buttons/command-button";
import { CopyButton } from "@/components/evil-buttons/copy-button";
import { ClickPowerUp } from "@/components/evil-buttons/click-powerup";
import { PillButton } from "@/components/evil-buttons/pill-button";

export function CommandButtonPreview() {
  const p = useDialKit(
    "CommandButton",
    {
      label: "Save",
      shortcut: "mod+s",
      showShortcut: true,
      preventDefault: true,
    },
    { id: "command-button" },
  );

  return (
    <CommandButton
      shortcut={p.shortcut}
      showShortcut={p.showShortcut}
      preventDefault={p.preventDefault}
    >
      {p.label}
    </CommandButton>
  );
}

export function CopyButtonPreview() {
  const p = useDialKit(
    "CopyButton",
    {
      value: "npx evil-buttons@latest init",
      copyLabel: "Copy",
      copiedLabel: "Copied",
      errorLabel: "Failed",
      timeout: [1500, 500, 5000],
      showValue: true,
    },
    { id: "copy-button" },
  );

  return (
    <CopyButton
      value={p.value}
      copyLabel={p.copyLabel}
      copiedLabel={p.copiedLabel}
      errorLabel={p.errorLabel}
      timeout={p.timeout}
      showValue={p.showValue}
    />
  );
}

export function ClickPowerUpPreview() {
  const p = useDialKit(
    "ClickPowerUp",
    {
      label: "Doom",
      tapDuration: [500, 200, 2000],
      accentColor: { type: "color", default: "#2CD4BD" },
    },
    { id: "click-powerup" },
  );

  return (
    <ClickPowerUp tapDuration={p.tapDuration} accentColor={p.accentColor}>
      {p.label}
    </ClickPowerUp>
  );
}

export function PillButtonPreview() {
  const p = useThemedDialKit(
    "PillButton",
    () => ({
      primaryLabel: "Off",
      secondaryLabel: "On",
      defaultOpen: false,
    }),
    { id: "pill-button" },
  );
  const isDark = useIsDarkMode();
  const classes = pillClassNames(isDark);

  return (
    <PillButton
      primaryLabel={p.primaryLabel}
      secondaryLabel={p.secondaryLabel}
      defaultOpen={p.defaultOpen}
      primaryClassName={classes.primaryClassName}
      secondaryClassName={classes.secondaryClassName}
    />
  );
}