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
}

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
        onClick={(event) => {
          onClick?.(event);
          fire();
        }}
        className={cn(
          "relative inline-flex h-9 cursor-pointer items-center justify-center gap-2.5 rounded-[10px] px-4 text-sm font-medium outline-none select-none",
          // Graded dark surface: dark outer hairline, faint inner ring, top highlight, soft drop.
          "bg-linear-to-b from-[#353535] to-[#272727] text-neutral-50 shadow-[0_0_0_1px_rgb(0_0_0/0.9),inset_0_0_0_1px_rgb(255_255_255/0.06),inset_0_1px_0_rgb(255_255_255/0.14),0_1px_2px_rgb(0_0_0/0.25),0_4px_12px_-4px_rgb(0_0_0/0.4)]",
          "transition-[transform,filter,box-shadow] duration-300 ease-[cubic-bezier(0.34,1.35,0.64,1)] hover:brightness-110",
          // Press eases in fast and settles the shadow; release springs back on the slower base curve.
          "active:scale-[0.97] active:brightness-95 active:duration-100 active:ease-out active:shadow-[0_0_0_1px_rgb(0_0_0/0.9),inset_0_0_0_1px_rgb(255_255_255/0.05),inset_0_1px_0_rgb(255_255_255/0.08),0_0_1px_rgb(0_0_0/0.2),0_1px_3px_-2px_rgb(0_0_0/0.3)] motion-reduce:active:scale-100",
          // The shortcut has no :active state, so data-firing plays the same press.
          "data-firing:scale-[0.97] data-firing:brightness-95 data-firing:duration-100 data-firing:ease-out data-firing:shadow-[0_0_0_1px_rgb(0_0_0/0.9),inset_0_0_0_1px_rgb(255_255_255/0.05),inset_0_1px_0_rgb(255_255_255/0.08),0_0_1px_rgb(0_0_0/0.2),0_1px_3px_-2px_rgb(0_0_0/0.3)] motion-reduce:data-firing:scale-100",
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
            className="inline-flex items-center gap-0.5 font-sans"
          >
            {parts.map((part) => (
              <span
                key={part}
                aria-hidden
                data-pressed={firing || held.has(part) || undefined}
                className={cn(
                  "inline-flex h-5 min-w-5 items-center justify-center rounded-[4px] bg-white/8 px-1 text-[11px] leading-none font-medium text-neutral-50/55 inset-ring inset-ring-white/6 transition-[transform,background-color,color] duration-100",
                  "data-pressed:translate-y-px data-pressed:bg-white/20 data-pressed:text-neutral-50",
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
