"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import {
  AnimatePresence,
  motion,
  useReducedMotion,
  type Variants,
} from "motion/react";
import { cn } from "@/lib/utils";
import { Twemoji } from "@/components/twemoji";

type CaptchaState = "idle" | "open" | "success";

type Tile = {
  id: number;
  emoji: string;
  evil: boolean;
};

type Placement = "top" | "bottom";

type Coords = {
  /** Viewport x of the trigger center; the panel is centered on this. */
  centerX: number;
  /** Distance from the top of the viewport to the panel's top (bottom placement). */
  top: number;
  /** Distance from the bottom of the viewport to the panel's bottom (top placement). */
  bottom: number;
  placement: Placement;
};

export interface CaptchaButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onClick"> {
  /** Trigger label. Falls back to `label` when no children are provided. */
  children?: React.ReactNode;
  /** Trigger label used when no children are provided. */
  label?: React.ReactNode;
  /** Fired once the user passes the captcha. */
  onConfirm?: () => void;
  /** Label flashed briefly after the captcha is passed. */
  successLabel?: React.ReactNode;
  /** Milliseconds to stay in the success state before resetting. Set to 0 to stay. */
  resetAfter?: number;
}

const EVIL_EMOJIS = ["😈", "👿", "💀", "👹", "🦇", "🕷️", "👺"];
const INNOCENT_EMOJIS = ["😇", "🌸", "🐶", "☁️", "🍦", "🌈", "🐤", "🌻"];

// Each prompt names the "evil" category the user must select.
const PROMPTS = [
  "Select all the demons",
  "Click every cursed soul",
  "Select all that is evil",
  "Select all the nightmares",
  "Click everything unholy",
];

const TAUNTS = [
  "Not evil enough. Again.",
  "Pathetic. The darkness rejects you.",
  "Wrong. Even angels are disappointed.",
  "Try harder, mortal.",
  "That was adorably innocent. No.",
  "The abyss is unimpressed.",
];

// Panel sizing used both for layout (w-64) and for flip math.
const PANEL_WIDTH = 256;
const PANEL_HEIGHT_ESTIMATE = 300;
const GAP = 8;

function shuffle<T>(input: T[]): T[] {
  const arr = [...input];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function pick<T>(input: T[], count: number): T[] {
  return shuffle(input).slice(0, count);
}

type Challenge = {
  prompt: string;
  tiles: Tile[];
};

function buildChallenge(): Challenge {
  // Between 2 and 4 evil tiles so there is always a non-trivial selection.
  const evilCount = 2 + Math.floor(Math.random() * 3);
  const innocentCount = 9 - evilCount;

  const evilTiles: Tile[] = pick(EVIL_EMOJIS, evilCount).map((emoji, i) => ({
    id: i,
    emoji,
    evil: true,
  }));
  const innocentTiles: Tile[] = pick(INNOCENT_EMOJIS, innocentCount).map(
    (emoji, i) => ({
      id: evilCount + i,
      emoji,
      evil: false,
    }),
  );

  return {
    prompt: PROMPTS[Math.floor(Math.random() * PROMPTS.length)],
    tiles: shuffle([...evilTiles, ...innocentTiles]),
  };
}

const panelVariants: Variants = {
  hidden: { opacity: 0, scale: 0.96 },
  visible: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.96 },
};

export const CaptchaButton = React.forwardRef<
  HTMLButtonElement,
  CaptchaButtonProps
>(
  (
    {
      children,
      label = "Do something evil",
      onConfirm,
      successLabel = "Access granted",
      resetAfter = 1600,
      className,
      type = "button",
      ...props
    },
    ref,
  ) => {
    const reduceMotion = useReducedMotion();

    const [state, setState] = React.useState<CaptchaState>("idle");
    const [challenge, setChallenge] = React.useState<Challenge | null>(null);
    const [selected, setSelected] = React.useState<Set<number>>(new Set());
    const [taunt, setTaunt] = React.useState<string | null>(null);
    const [shakeKey, setShakeKey] = React.useState(0);
    const [coords, setCoords] = React.useState<Coords | null>(null);
    const [mounted, setMounted] = React.useState(false);

    React.useEffect(() => setMounted(true), []);

    const triggerRef = React.useRef<HTMLButtonElement | null>(null);
    const panelRef = React.useRef<HTMLDivElement | null>(null);
    const resetTimeoutRef = React.useRef<number | null>(null);

    const setTriggerRef = (node: HTMLButtonElement | null) => {
      triggerRef.current = node;
      if (typeof ref === "function") ref(node);
      else if (ref) ref.current = node;
    };

    const clearResetTimeout = () => {
      if (resetTimeoutRef.current !== null) {
        window.clearTimeout(resetTimeoutRef.current);
        resetTimeoutRef.current = null;
      }
    };

    React.useEffect(() => () => clearResetTimeout(), []);

    // Anchor the portaled panel to the trigger, flipping above when there is
    // not enough room below. Recomputed on open, scroll, and resize.
    const updateCoords = React.useCallback(() => {
      const node = triggerRef.current;
      if (!node) return;
      const rect = node.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const placement: Placement =
        spaceBelow < PANEL_HEIGHT_ESTIMATE + GAP && rect.top > spaceBelow
          ? "top"
          : "bottom";
      setCoords({
        centerX: rect.left + rect.width / 2,
        top: rect.bottom + GAP,
        bottom: window.innerHeight - rect.top + GAP,
        placement,
      });
    }, []);

    const openCaptcha = () => {
      clearResetTimeout();
      setChallenge(buildChallenge());
      setSelected(new Set());
      setTaunt(null);
      updateCoords();
      setState("open");
    };

    const closeCaptcha = () => {
      setState("idle");
      setChallenge(null);
      setSelected(new Set());
      setTaunt(null);
    };

    const nextRound = () => {
      setChallenge(buildChallenge());
      setSelected(new Set());
      setShakeKey((k) => k + 1);
    };

    // Dismiss on outside click / Escape, and keep the panel anchored while open.
    React.useEffect(() => {
      if (state !== "open") return;

      const onPointerDown = (e: PointerEvent) => {
        const target = e.target as Node;
        if (
          !triggerRef.current?.contains(target) &&
          !panelRef.current?.contains(target)
        ) {
          closeCaptcha();
        }
      };
      const onKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Escape") closeCaptcha();
      };
      const onReposition = () => updateCoords();

      document.addEventListener("pointerdown", onPointerDown);
      document.addEventListener("keydown", onKeyDown);
      window.addEventListener("scroll", onReposition, true);
      window.addEventListener("resize", onReposition);
      return () => {
        document.removeEventListener("pointerdown", onPointerDown);
        document.removeEventListener("keydown", onKeyDown);
        window.removeEventListener("scroll", onReposition, true);
        window.removeEventListener("resize", onReposition);
      };
    }, [state, updateCoords]);

    const toggleTile = (id: number) => {
      setSelected((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
    };

    const verify = () => {
      if (!challenge) return;
      const evilIds = challenge.tiles.filter((t) => t.evil).map((t) => t.id);
      const passed =
        selected.size === evilIds.length &&
        evilIds.every((id) => selected.has(id));

      if (passed) {
        setState("success");
        setChallenge(null);
        setSelected(new Set());
        setTaunt(null);
        onConfirm?.();
        if (resetAfter > 0) {
          resetTimeoutRef.current = window.setTimeout(() => {
            setState("idle");
          }, resetAfter);
        }
      } else {
        setTaunt(TAUNTS[Math.floor(Math.random() * TAUNTS.length)]);
        nextRound();
      }
    };

    const isSuccess = state === "success";
    const isOpen = state === "open";

    const panel = (
      <AnimatePresence>
        {isOpen && challenge && coords && (
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-label="Prove you are evil"
            variants={panelVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            transition={
              reduceMotion
                ? { duration: 0 }
                : { type: "spring", stiffness: 420, damping: 30 }
            }
            style={{
              position: "fixed",
              left: coords.centerX,
              marginLeft: -PANEL_WIDTH / 2,
              width: PANEL_WIDTH,
              zIndex: 9999,
              ...(coords.placement === "bottom"
                ? { top: coords.top }
                : { bottom: coords.bottom }),
            }}
            className="rounded-lg border border-border bg-popover p-3 text-popover-foreground shadow-xl"
          >
            <div className="mb-2 flex items-baseline justify-between gap-2">
                  <p className="text-xs font-semibold leading-tight">
                    {challenge.prompt}
                  </p>
                  <button
                    type="button"
                    aria-label="Close"
                    onClick={closeCaptcha}
                    className="-mr-1 -mt-1 cursor-pointer rounded p-1 text-muted-foreground transition-colors hover:text-foreground"
                  >
                    ✕
                  </button>
                </div>

                <motion.div
                  key={shakeKey}
                  animate={
                    reduceMotion || shakeKey === 0
                      ? undefined
                      : { x: [0, -8, 8, -6, 6, -3, 3, 0] }
                  }
                  transition={{ duration: 0.42, ease: "easeInOut" }}
                  className="grid grid-cols-3 gap-1.5"
                >
                  {challenge.tiles.map((tile) => {
                    const active = selected.has(tile.id);
                    return (
                      <motion.button
                        key={tile.id}
                        type="button"
                        aria-pressed={active}
                        onClick={() => toggleTile(tile.id)}
                        whileTap={reduceMotion ? undefined : { scale: 0.88 }}
                        className={cn(
                          "flex aspect-square items-center justify-center rounded-md border text-2xl transition-colors",
                          active
                            ? "border-red-500 bg-red-500/15 ring-2 ring-red-500/50"
                            : "border-border bg-muted/40 hover:bg-muted",
                        )}
                      >
                        <Twemoji className="size-[1.4em]">
                          {tile.emoji}
                        </Twemoji>
                      </motion.button>
                    );
                  })}
                </motion.div>

                <div className="mt-2 flex h-4 items-center">
                  <AnimatePresence mode="wait">
                    {taunt && (
                      <motion.p
                        key={taunt}
                        initial={reduceMotion ? false : { opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="text-[11px] font-medium text-red-500"
                      >
                        {taunt}
                      </motion.p>
                    )}
                  </AnimatePresence>
                </div>

                <button
                  type="button"
                  onClick={verify}
                  disabled={selected.size === 0}
                  className={cn(
                    "mt-1 w-full cursor-pointer rounded-md border border-red-500/40 bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-600 transition-colors dark:text-red-400",
                    "hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50",
                  )}
                >
                  Verify
                </button>
          </motion.div>
        )}
      </AnimatePresence>
    );

    return (
      <div className="relative inline-block w-fit">
        <button
          ref={setTriggerRef}
          type={type}
          data-state={state}
          aria-haspopup="dialog"
          aria-expanded={isOpen}
          onClick={() => {
            if (isSuccess) return;
            if (isOpen) closeCaptcha();
            else openCaptcha();
          }}
          className={cn(
            "relative inline-flex min-w-44 cursor-pointer select-none items-center justify-center gap-2 rounded-md border px-4 py-2.5 text-sm font-semibold shadow-sm outline-none transition-colors",
            "focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50",
            isSuccess
              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 focus-visible:ring-emerald-500 dark:text-emerald-400"
              : "border-transparent bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:ring-ring",
            className,
          )}
          {...props}
        >
          {isSuccess ? (
            <span aria-hidden>✓</span>
          ) : (
            <Twemoji className="my-0 size-[1.1em]">😈</Twemoji>
          )}
          <span>{isSuccess ? successLabel : (children ?? label)}</span>
        </button>

        {mounted && createPortal(panel, document.body)}
      </div>
    );
  },
);

CaptchaButton.displayName = "CaptchaButton";

export default CaptchaButton;
