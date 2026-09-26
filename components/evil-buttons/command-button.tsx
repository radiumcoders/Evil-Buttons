"use client";

import * as React from "react";
import { motion, useReducedMotion } from "motion/react";
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
    const reduceMotion = useReducedMotion();
    const parts = React.useMemo(() => parseShortcut(shortcut), [shortcut]);
    const [isApple, setIsApple] = React.useState(false);
    const [held, setHeld] = React.useState<ReadonlySet<string>>(new Set());
    const [firing, setFiring] = React.useState(false);
    const [fireCount, setFireCount] = React.useState(0);
    const fireTimerRef = React.useRef<number | undefined>(undefined);
    const onCommandRef = React.useRef(onCommand);

    React.useEffect(() => {
      onCommandRef.current = onCommand;
    }, [onCommand]);

    // Platform is only known on the client, so detect it after hydration.
    React.useEffect(() => setIsApple(detectApple()), []);

    const fire = React.useCallback(() => {
      setFireCount((count) => count + 1);
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
      <motion.button
        ref={ref}
        type={type}
        disabled={disabled}
        data-shortcut={shortcut}
        aria-keyshortcuts={parts
          .map((part) =>
            part === "mod" ? (isApple ? "Meta" : "Control") : part,
          )
          .join("+")}
        onClick={(event) => {
          onClick?.(event);
          fire();
        }}
        animate={
          fireCount && !reduceMotion ? { scale: firing ? 0.97 : 1 } : undefined
        }
        transition={{ type: "spring", stiffness: 600, damping: 26 }}
        className={cn(
          "relative inline-flex h-9 cursor-pointer items-center justify-center gap-3 overflow-hidden rounded-md bg-primary pl-4 text-sm font-medium text-primary-foreground shadow-xs outline-none select-none transition-colors hover:bg-primary/90",
          showShortcut ? "pr-1.5" : "pr-4",
          "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
        {...props}
      >
        {/* Brief sheen across the face each time the command fires. */}
        {fireCount > 0 && !reduceMotion ? (
          <motion.span
            key={fireCount}
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-primary-foreground"
            initial={{ opacity: 0.18 }}
            animate={{ opacity: 0 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
          />
        ) : null}
        <span className="relative">{children}</span>
        {showShortcut ? (
          <kbd
            aria-label={label}
            className="relative inline-flex items-center gap-1 font-sans"
          >
            {parts.map((part) => {
              const down = firing || held.has(part);
              return (
                <span
                  key={part}
                  aria-hidden
                  className={cn(
                    "inline-flex h-6 min-w-6 items-center justify-center rounded-[5px] bg-primary-foreground/12 px-1.5 font-mono text-[11px] leading-none text-primary-foreground/85 inset-ring inset-ring-primary-foreground/15 transition-[transform,box-shadow,background-color] duration-75",
                    down
                      ? "translate-y-0.5 bg-primary-foreground/20 shadow-none"
                      : "shadow-[0_2px_0_color-mix(in_oklab,var(--primary-foreground)_12%,black)]",
                  )}
                >
                  {formatPart(part, isApple)}
                </span>
              );
            })}
          </kbd>
        ) : null}
      </motion.button>
    );
  },
);

CommandButton.displayName = "CommandButton";
