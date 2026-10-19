"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface CommandButtonProps extends Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  "onDrag" | "onDragStart" | "onDragEnd" | "onAnimationStart"
> {
  /** Shortcut like `"mod+s"`. `mod` is ⌘ on Apple devices and Ctrl elsewhere. */
  shortcut?: string;
  /** Fired when the keyboard shortcut is pressed. */
  onCommand?: () => void;
  /** Stop the browser's own handling of the shortcut, like the save dialog. */
  preventDefault?: boolean;
  /** Show the shortcut as keycaps inside the button. */
  showShortcut?: boolean;
  /**
   * Surface style. `"auto"` is light and switches to the dark graphite face under
   * a `.dark` ancestor; `"dark"` and `"light"` force one face.
   * @default "auto"
   */
  variant?: CommandButtonVariant;
}

export type CommandButtonVariant = "auto" | "dark" | "light";

// Graded surfaces matching MinimalButton, with the settled press shadow for both `:active` and
// `data-firing`, plus recessed keycaps that brighten while pressed. Tailwind only sees literal
// class names, so the `dark:` half of "auto" is spelled out in full.
const surfaces: Record<CommandButtonVariant, { base: string; cap: string }> = {
  dark: {
    base: "text-neutral-50 bg-linear-to-b from-[#353535] to-[#272727] shadow-[0_0_0_1px_rgb(0_0_0/0.9),inset_0_0_0_1px_rgb(255_255_255/0.06),inset_0_1px_0_rgb(255_255_255/0.14),0_1px_2px_rgb(0_0_0/0.25),0_4px_12px_-4px_rgb(0_0_0/0.4)] active:shadow-[0_0_0_1px_rgb(0_0_0/0.9),inset_0_0_0_1px_rgb(255_255_255/0.05),inset_0_1px_0_rgb(255_255_255/0.08),0_0_1px_rgb(0_0_0/0.2),0_1px_3px_-2px_rgb(0_0_0/0.3)] data-firing:shadow-[0_0_0_1px_rgb(0_0_0/0.9),inset_0_0_0_1px_rgb(255_255_255/0.05),inset_0_1px_0_rgb(255_255_255/0.08),0_0_1px_rgb(0_0_0/0.2),0_1px_3px_-2px_rgb(0_0_0/0.3)]",
    cap: "bg-white/8 text-neutral-50/55 inset-ring-white/6 data-pressed:bg-white/20 data-pressed:text-neutral-50 group-active/cmd:bg-white/20 group-active/cmd:text-neutral-50 group-data-firing/cmd:bg-white/20 group-data-firing/cmd:text-neutral-50",
  },
  light: {
    base: "text-neutral-900 bg-linear-to-b from-white to-neutral-100 shadow-[0_0_0_1px_rgb(0_0_0/0.1),inset_0_1px_0_rgb(255_255_255/0.9),0_1px_2px_rgb(0_0_0/0.06),0_4px_12px_-4px_rgb(0_0_0/0.14)] active:shadow-[0_0_0_1px_rgb(0_0_0/0.12),inset_0_1px_0_rgb(255_255_255/0.6),0_0_1px_rgb(0_0_0/0.05),0_1px_3px_-2px_rgb(0_0_0/0.12)] data-firing:shadow-[0_0_0_1px_rgb(0_0_0/0.12),inset_0_1px_0_rgb(255_255_255/0.6),0_0_1px_rgb(0_0_0/0.05),0_1px_3px_-2px_rgb(0_0_0/0.12)]",
    cap: "bg-neutral-900/6 text-neutral-900/50 inset-ring-neutral-900/8 data-pressed:bg-neutral-900/12 data-pressed:text-neutral-900 group-active/cmd:bg-neutral-900/12 group-active/cmd:text-neutral-900 group-data-firing/cmd:bg-neutral-900/12 group-data-firing/cmd:text-neutral-900",
  },
  auto: {
    base: "text-foreground bg-linear-to-b from-background to-muted shadow-[0_0_0_1px_rgb(0_0_0/0.1),inset_0_1px_0_rgb(255_255_255/0.9),0_1px_2px_rgb(0_0_0/0.06),0_4px_12px_-4px_rgb(0_0_0/0.14)] active:shadow-[0_0_0_1px_rgb(0_0_0/0.12),inset_0_1px_0_rgb(255_255_255/0.6),0_0_1px_rgb(0_0_0/0.05),0_1px_3px_-2px_rgb(0_0_0/0.12)] data-firing:shadow-[0_0_0_1px_rgb(0_0_0/0.12),inset_0_1px_0_rgb(255_255_255/0.6),0_0_1px_rgb(0_0_0/0.05),0_1px_3px_-2px_rgb(0_0_0/0.12)] dark:text-neutral-50 dark:from-[#353535] dark:to-[#272727] dark:shadow-[0_0_0_1px_rgb(0_0_0/0.9),inset_0_0_0_1px_rgb(255_255_255/0.06),inset_0_1px_0_rgb(255_255_255/0.14),0_1px_2px_rgb(0_0_0/0.25),0_4px_12px_-4px_rgb(0_0_0/0.4)] dark:active:shadow-[0_0_0_1px_rgb(0_0_0/0.9),inset_0_0_0_1px_rgb(255_255_255/0.05),inset_0_1px_0_rgb(255_255_255/0.08),0_0_1px_rgb(0_0_0/0.2),0_1px_3px_-2px_rgb(0_0_0/0.3)] dark:data-firing:shadow-[0_0_0_1px_rgb(0_0_0/0.9),inset_0_0_0_1px_rgb(255_255_255/0.05),inset_0_1px_0_rgb(255_255_255/0.08),0_0_1px_rgb(0_0_0/0.2),0_1px_3px_-2px_rgb(0_0_0/0.3)]",
    cap: "bg-foreground/6 text-foreground/50 inset-ring-foreground/8 data-pressed:bg-foreground/12 data-pressed:text-foreground group-active/cmd:bg-foreground/12 group-active/cmd:text-foreground group-data-firing/cmd:bg-foreground/12 group-data-firing/cmd:text-foreground dark:bg-white/8 dark:text-neutral-50/55 dark:inset-ring-white/6 dark:data-pressed:bg-white/20 dark:data-pressed:text-neutral-50 dark:group-active/cmd:bg-white/20 dark:group-active/cmd:text-neutral-50 dark:group-data-firing/cmd:bg-white/20 dark:group-data-firing/cmd:text-neutral-50",
  },
};

const MODIFIERS = ["mod", "ctrl", "alt", "shift"] as const;
/** How long a fired shortcut keeps every cap pressed. */
const FIRE_MS = 160;

function normalizeKey(value: string) {
  const key = value.toLowerCase();
  if (key === "cmd" || key === "command" || key === "meta") return "mod";
  if (key === "control") return "ctrl";
  if (key === "option") return "alt";
  if (key === "escape") return "esc";
  if (key === "return") return "enter";
  if (key === " " || key === "spacebar") return "space";
  return key;
}

function parseShortcut(shortcut: string) {
  return shortcut
    .split("+")
    .map((part) => normalizeKey(part.trim()))
    .filter(Boolean);
}

function shortcutMatches(event: KeyboardEvent, parts: string[]) {
  const wantsMod = parts.includes("mod");
  const wantsCtrl = parts.includes("ctrl");
  const finalKey = parts.find(
    (part) => !(MODIFIERS as readonly string[]).includes(part),
  );

  if (wantsMod && !(event.metaKey || event.ctrlKey)) return false;
  if (!wantsMod && wantsCtrl !== event.ctrlKey) return false;
  if (parts.includes("alt") !== event.altKey) return false;
  if (parts.includes("shift") !== event.shiftKey) return false;
  return finalKey ? normalizeKey(event.key) === finalKey : false;
}

/** Whether a single shortcut part is physically held in this key event. */
function partHeld(part: string, event: KeyboardEvent, isApple: boolean) {
  if (part === "mod") return isApple ? event.metaKey : event.ctrlKey;
  if (part === "ctrl") return event.ctrlKey;
  if (part === "alt") return event.altKey;
  if (part === "shift") return event.shiftKey;
  return false;
}

function formatPart(part: string, isApple: boolean) {
  if (part === "mod") return isApple ? "⌘" : "Ctrl";
  if (part === "ctrl") return isApple ? "⌃" : "Ctrl";
  if (part === "alt") return isApple ? "⌥" : "Alt";
  if (part === "shift") return isApple ? "⇧" : "Shift";
  if (part === "enter") return "↵";
  if (part === "esc") return "Esc";
  if (part === "space") return "Space";
  if (part === "arrowup") return "↑";
  if (part === "arrowdown") return "↓";
  if (part === "arrowleft") return "←";
  if (part === "arrowright") return "→";
  return part.length === 1 ? part.toUpperCase() : part;
}

function detectApple() {
  if (typeof navigator === "undefined") return false;
  return /mac|iphone|ipad|ipod/i.test(
    navigator.platform || navigator.userAgent,
  );
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
      variant = "auto",
      className,
      children = "Save",
      disabled,
      onClick,
      type = "button",
      ...props
    },
    ref,
  ) => {
    const parts = React.useMemo(() => parseShortcut(shortcut), [shortcut]);
    const [isApple, setIsApple] = React.useState(false);
    const [held, setHeld] = React.useState<ReadonlySet<string>>(new Set());
    const [firing, setFiring] = React.useState(false);
    const fireTimerRef = React.useRef<number | undefined>(undefined);
    const onCommandRef = React.useRef(onCommand);

    React.useEffect(() => {
      onCommandRef.current = onCommand;
    }, [onCommand]);

    // Platform is only known on the client, so detect it after hydration.
    React.useEffect(() => setIsApple(detectApple()), []);

    const fire = React.useCallback(() => {
      setFiring(true);
      window.clearTimeout(fireTimerRef.current);
      fireTimerRef.current = window.setTimeout(() => setFiring(false), FIRE_MS);
    }, []);

    React.useEffect(() => {
      if (disabled) return;

      // Mirror which modifier caps are held so each one sinks as it's pressed.
      const syncModifiers = (event: KeyboardEvent) => {
        const next = new Set(
          parts.filter((part) => partHeld(part, event, isApple)),
        );
        setHeld((current) =>
          current.size === next.size &&
          [...next].every((part) => current.has(part))
            ? current
            : next,
        );
      };

      const handleKeyDown = (event: KeyboardEvent) => {
        syncModifiers(event);
        if (event.repeat || !shortcutMatches(event, parts)) return;
        if (preventDefault) event.preventDefault();
        fire();
        onCommandRef.current?.();
      };
      const clear = () => setHeld(new Set());

      window.addEventListener("keydown", handleKeyDown);
      window.addEventListener("keyup", syncModifiers);
      window.addEventListener("blur", clear);
      return () => {
        window.removeEventListener("keydown", handleKeyDown);
        window.removeEventListener("keyup", syncModifiers);
        window.removeEventListener("blur", clear);
        clear();
      };
    }, [disabled, fire, isApple, parts, preventDefault]);

    React.useEffect(() => () => window.clearTimeout(fireTimerRef.current), []);

    const label = parts.map((part) => formatPart(part, isApple)).join(" ");
    const surface = surfaces[variant];

    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled}
        data-shortcut={shortcut}
        data-firing={firing || undefined}
        aria-keyshortcuts={parts
          .map((part) =>
            part === "mod" ? (isApple ? "Meta" : "Control") : part,
          )
          .join("+")}
        onClick={onClick}
        className={cn(
          "group/cmd relative inline-flex h-9 cursor-pointer items-center justify-center gap-2.5 rounded-[10px] px-4 text-sm font-medium outline-none select-none",
          // Graded surface, plus the settled press shadow (see `surfaces`).
          surface.base,
          "transition-[scale,filter,box-shadow] duration-300 ease-[cubic-bezier(0.34,1.35,0.64,1)] hover:brightness-110",
          // Press eases in fast; release springs back on the slower base curve.
          "active:scale-[0.97] active:brightness-95 active:duration-100 active:ease-out motion-reduce:active:scale-100",
          // The shortcut has no :active state, so data-firing plays the same press.
          "data-firing:scale-[0.97] data-firing:brightness-95 data-firing:duration-100 data-firing:ease-out motion-reduce:data-firing:scale-100",
          showShortcut && "pr-2",
          "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        {...props}
      >
        <span>{children}</span>
        {showShortcut ? (
          <kbd
            aria-label={label}
            // Caps are sized in em off the button's text (14px by default), so a larger
            // `text-*` on the button scales them with the label.
            className="inline-flex items-center gap-[calc(2em/14)] font-sans"
          >
            {parts.map((part) => (
              <span
                key={part}
                aria-hidden
                data-pressed={held.has(part) || undefined}
                className={cn(
                  "inline-flex h-[calc(20em/11)] min-w-[calc(20em/11)] items-center justify-center rounded-[calc(4em/11)] px-[calc(4em/11)] text-[calc(11em/14)] leading-none font-medium inset-ring transition-[translate,background-color,color] duration-300 ease-[cubic-bezier(0.34,1.35,0.64,1)]",
                  // Tone of the cap at rest and while pressed (see `surfaces`).
                  surface.cap,
                  // Same states and timing as the button's press, so caps and button move on the same frame.
                  "data-pressed:translate-y-px data-pressed:duration-100 data-pressed:ease-out",
                  "group-active/cmd:translate-y-px group-active/cmd:duration-100 group-active/cmd:ease-out",
                  "group-data-firing/cmd:translate-y-px group-data-firing/cmd:duration-100 group-data-firing/cmd:ease-out",
                )}
              >
                {formatPart(part, isApple)}
              </span>
            ))}
          </kbd>
        ) : null}
      </button>
    );
  },
);

CommandButton.displayName = "CommandButton";
