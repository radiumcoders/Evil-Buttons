"use client";

import * as React from "react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";

export interface CommandButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  shortcut?: string;
  onCommand?: () => void;
  preventDefault?: boolean;
  showShortcut?: boolean;
}

function normalizeKey(value: string) {
  const key = value.toLowerCase();
  if (key === "cmd" || key === "command" || key === "meta") return "mod";
  if (key === "control") return "ctrl";
  if (key === "option") return "alt";
  if (key === "escape") return "esc";
  return key;
}

function shortcutMatches(event: KeyboardEvent, shortcut: string) {
  const parts = shortcut.split("+").map((part) => normalizeKey(part.trim()));
  const key = normalizeKey(event.key);
  const wantsMod = parts.includes("mod");
  const wantsCtrl = parts.includes("ctrl");
  const wantsAlt = parts.includes("alt");
  const wantsShift = parts.includes("shift");
  const finalKey = parts.find(
    (part) => !["mod", "ctrl", "alt", "shift"].includes(part),
  );

  if (wantsMod && !(event.metaKey || event.ctrlKey)) return false;
  if (!wantsMod && wantsCtrl !== event.ctrlKey) return false;
  if (wantsAlt !== event.altKey) return false;
  if (wantsShift !== event.shiftKey) return false;
  return finalKey ? key === finalKey : false;
}

function formatShortcut(shortcut: string) {
  return shortcut
    .split("+")
    .map((part) => {
      const key = normalizeKey(part.trim());
      if (key === "mod") return "⌘";
      if (key === "ctrl") return "Ctrl";
      if (key === "alt") return "Alt";
      if (key === "shift") return "Shift";
      if (key === "esc") return "Esc";
      return key.length === 1 ? key.toUpperCase() : key;
    })
    .join(" ");
}

export const CommandButton = React.forwardRef<
  HTMLButtonElement,
  CommandButtonProps
>(
  (
    {
      shortcut = "mod+s",
      onCommand,
      preventDefault = true,
      showShortcut = true,
      className,
      children = "Save",
      disabled,
      type = "button",
      ...props
    },
    ref,
  ) => {
    const [pulse, setPulse] = React.useState(0);

    React.useEffect(() => {
      if (disabled) return;
      const handleKeyDown = (event: KeyboardEvent) => {
        if (!shortcutMatches(event, shortcut)) return;
        if (preventDefault) event.preventDefault();
        setPulse((value) => value + 1);
        onCommand?.();
      };

      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }, [disabled, onCommand, preventDefault, shortcut]);

    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled}
        data-shortcut={shortcut}
        className={cn(
          "relative inline-flex items-center justify-center gap-3 overflow-hidden rounded-md border border-neutral-950 bg-neutral-950 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors",
          "hover:bg-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60",
          "dark:border-white dark:bg-white dark:text-neutral-950 dark:hover:bg-neutral-200",
          className,
        )}
        {...props}
      >
        <motion.span
          key={pulse}
          aria-hidden
          initial={{ opacity: 0, scale: 0.8 }}
          animate={
            pulse
              ? { opacity: [0, 0.18, 0], scale: [0.8, 1.15, 1.3] }
              : { opacity: 0 }
          }
          transition={{ duration: 0.22 }}
          className="pointer-events-none absolute inset-0 rounded-md bg-foreground"
        />
        <motion.span
          key={`label-${pulse}`}
          initial={{ scale: 1, y: 0 }}
          animate={
            pulse ? { scale: [1, 0.96, 1], y: [0, 1, 0] } : undefined
          }
          transition={{ duration: 0.18 }}
          className="relative z-10 inline-flex items-center gap-3"
        >
          <span>{children}</span>
          {showShortcut ? (
            <kbd className="rounded border border-white/25 bg-white/12 px-1.5 py-0.5 font-mono text-[11px] font-medium text-white/80 dark:border-neutral-950/20 dark:bg-neutral-950/10 dark:text-neutral-950/75">
              {formatShortcut(shortcut)}
            </kbd>
          ) : null}
        </motion.span>
      </button>
    );
  },
);

CommandButton.displayName = "CommandButton";
