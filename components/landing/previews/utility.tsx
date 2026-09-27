"use client";

import { useDialKit } from "dialkit";
import { CommandButton } from "@/components/evil-buttons/command-button";
import { CopyButton } from "@/components/evil-buttons/copy-button";
import { ClickPowerUp } from "@/components/evil-buttons/click-powerup";
import {
  RealisticSwitch,
  type RealisticSwitchSize,
} from "@/components/evil-buttons/realistic-switch";
import { LiveProps } from "./live-props";

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
    <LiveProps>
      <CommandButton
        shortcut={p.shortcut}
        showShortcut={p.showShortcut}
        preventDefault={p.preventDefault}
      >
        {p.label}
      </CommandButton>
    </LiveProps>
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
    <LiveProps>
      <CopyButton
        value={p.value}
        copyLabel={p.copyLabel}
        copiedLabel={p.copiedLabel}
        errorLabel={p.errorLabel}
        timeout={p.timeout}
        showValue={p.showValue}
      />
    </LiveProps>
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
    <LiveProps>
      <ClickPowerUp tapDuration={p.tapDuration} accentColor={p.accentColor}>
        {p.label}
      </ClickPowerUp>
    </LiveProps>
  );
}

export function RealisticSwitchPreview() {
  const p = useDialKit(
    "RealisticSwitch",
    {
      color: { type: "color", default: "#e1261c" },
      markColor: { type: "color", default: "#ffffff" },
      illuminated: true,
      sound: true,
      defaultChecked: false,
      size: { type: "select", options: ["sm", "default", "lg"], default: "lg" },
    },
    { id: "realistic-switch" },
  );

  return (
    <LiveProps>
      <RealisticSwitch
        color={p.color}
        markColor={p.markColor}
        illuminated={p.illuminated}
        sound={p.sound}
        defaultChecked={p.defaultChecked}
        size={p.size as RealisticSwitchSize}
      />
    </LiveProps>
  );
}
