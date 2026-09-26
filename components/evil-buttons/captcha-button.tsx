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

type CaptchaState = "idle" | "open" | "success";

type Tile = {
  id: number;
  icon: IconName;
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

/** 24px line icons, drawn with the same stroke so every tile reads as one set. */
const ICONS = {
  skull: (
    <>
      <path d="M12 3a7 7 0 0 0-7 7c0 2.4 1.2 4 2.5 5v3a1 1 0 0 0 1 1h7a1 1 0 0 0 1-1v-3c1.3-1 2.5-2.6 2.5-5a7 7 0 0 0-7-7Z" />
      <circle cx="9.5" cy="11" r="1.5" />
      <circle cx="14.5" cy="11" r="1.5" />
      <path d="M10.5 19v-2M13.5 19v-2" />
    </>
  ),
  flame: (
    <path d="M12 3c.5 3-2 4.5-3.5 6.5S7 13 7 15a5 5 0 0 0 10 0c0-2-1-3.5-2-4.5 0 1.5-.8 2.5-2 3 .8-3.5-.2-7.5-1-10.5Z" />
  ),
  ghost: (
    <>
      <path d="M6 20V10a6 6 0 0 1 12 0v10l-2-1.5-2 1.5-2-1.5-2 1.5-2-1.5L6 20Z" />
      <path d="M10 10v1M14 10v1" />
    </>
  ),
  devil: (
    <>
      <circle cx="12" cy="13.5" r="6" />
      <path d="M7.6 9.4 6 4.5l4 2.9M16.4 9.4 18 4.5l-4 2.9" />
      <path d="m9 12 1.5.75M15 12l-1.5.75M9.5 16c1.5 1 3.5 1 5 0" />
    </>
  ),
  dagger: (
    <>
      <path d="M12 2.5 14 6v8h-4V6l2-3.5Z" />
      <path d="M8 14h8M12 14v5" />
      <circle cx="12" cy="20.5" r="1" />
    </>
  ),
  spider: (
    <>
      <circle cx="12" cy="14" r="3" />
      <circle cx="12" cy="9.25" r="1.75" />
      <path d="M9.4 12.5 6 10l-1-4.5M14.6 12.5 18 10l1-4.5M9 14H5l-1.5 3M15 14h4l1.5 3M9.8 16.2 7 19l-.5 2.5M14.2 16.2 17 19l.5 2.5" />
    </>
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" />
    </>
  ),
  tulip: (
    <>
      <path d="M7 5l2.5 2L12 4l2.5 3L17 5v4a5 5 0 0 1-10 0V5Z" />
      <path d="M12 14v7M12 18.5c1.5-2 3.5-2.5 5-2.5-.5 2-2.5 3.5-5 3.5" />
    </>
  ),
  cloud: (
    <path d="M7 18h10a4 4 0 0 0 .5-7.97A6 6 0 0 0 6.1 10.5 3.75 3.75 0 0 0 7 18Z" />
  ),
  heart: (
    <path d="M12 20s-7-4.35-7-10a4 4 0 0 1 7-2.65A4 4 0 0 1 19 10c0 5.65-7 10-7 10Z" />
  ),
  star: (
    <path d="m12 3.5 2.6 5.3 5.9.9-4.25 4.1 1 5.8L12 16.9l-5.25 2.7 1-5.8L3.5 9.7l5.9-.9L12 3.5Z" />
  ),
  leaf: (
    <>
      <path d="M5 19c0-8 5-14 14-14 0 9-6 14-14 14Z" />
      <path d="m5 19 8-8" />
    </>
  ),
  cup: (
    <>
      <path d="M5 9h11v5a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5V9Z" />
      <path d="M16 10h1.5a2.5 2.5 0 0 1 0 5H16M9 3.5v2.5M12.5 3.5v2.5" />
    </>
  ),
  balloon: (
    <>
      <path d="M12 3a5 5.5 0 0 0-5 5.5c0 3.2 2.5 6 5 6s5-2.8 5-6A5 5.5 0 0 0 12 3Z" />
      <path d="M12 14.5c-1 1.5 1 3 0 6.5" />
    </>
  ),
} satisfies Record<string, React.ReactNode>;

type IconName = keyof typeof ICONS;

const EVIL_ICONS: IconName[] = ["skull", "flame", "ghost", "devil", "dagger", "spider"];
const INNOCENT_ICONS: IconName[] = ["sun", "tulip", "cloud", "heart", "star", "leaf", "cup", "balloon"];

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
const PANEL_HEIGHT_ESTIMATE = 330;
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

  const evilTiles: Tile[] = pick(EVIL_ICONS, evilCount).map((icon, i) => ({
    id: i,
    icon,
    evil: true,
  }));
  const innocentTiles: Tile[] = pick(INNOCENT_ICONS, innocentCount).map(
    (icon, i) => ({
      id: evilCount + i,
      icon,
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
      // Return focus to the trigger after dismissing the dialog.
      window.requestAnimationFrame(() => {
        triggerRef.current?.focus();
      });
    };

    const nextRound = () => {
      setChallenge(buildChallenge());
      setSelected(new Set());
      setShakeKey((k) => k + 1);
    };

    // Dismiss on outside click / Escape, trap Tab inside the panel, move
    // initial focus into the dialog, and keep the panel anchored while open.
    React.useEffect(() => {
      if (state !== "open") return;

      const focusFirst = () => {
        const panel = panelRef.current;
        if (!panel) return;
        const focusable = panel.querySelector<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        );
        focusable?.focus();
      };

      const rafId = window.requestAnimationFrame(focusFirst);

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
        if (e.key === "Escape") {
          e.preventDefault();
          closeCaptcha();
          return;
        }

        if (e.key !== "Tab" || !panelRef.current) return;

        const focusable = Array.from(
          panelRef.current.querySelectorAll<HTMLElement>(
            'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
          ),
        ).filter((el) => !el.hasAttribute("disabled") && el.tabIndex !== -1);

        if (focusable.length === 0) {
          e.preventDefault();
          return;
        }

        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        const active = document.activeElement as HTMLElement | null;

        if (e.shiftKey) {
          if (active === first || !panelRef.current.contains(active)) {
            e.preventDefault();
            last.focus();
          }
        } else if (active === last || !panelRef.current.contains(active)) {
          e.preventDefault();
          first.focus();
        }
      };
      const onReposition = () => updateCoords();

      document.addEventListener("pointerdown", onPointerDown);
      document.addEventListener("keydown", onKeyDown);
      window.addEventListener("scroll", onReposition, true);
      window.addEventListener("resize", onReposition);
      return () => {
        window.cancelAnimationFrame(rafId);
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
            aria-modal="true"
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
              transformOrigin:
                coords.placement === "bottom" ? "top center" : "bottom center",
              ...(coords.placement === "bottom"
                ? { top: coords.top }
                : { bottom: coords.bottom }),
            }}
            className="rounded-[14px] bg-[#1f1f1f] p-2 text-neutral-50 shadow-[0_0_0_1px_rgb(0_0_0/0.9),inset_0_0_0_1px_rgb(255_255_255/0.06),inset_0_1px_0_rgb(255_255_255/0.1),0_12px_32px_-8px_rgb(0_0_0/0.6)]"
          >
            <div className="flex items-start justify-between gap-2 px-1.5 pt-1 pb-2.5">
              <div className="min-w-0">
                <p className="text-[10px] font-medium tracking-wider text-neutral-50/40 uppercase">
                  Verification
                </p>
                <p className="mt-0.5 text-[13px] leading-tight font-medium">
                  {challenge.prompt}
                </p>
              </div>
              <button
                type="button"
                aria-label="Close"
                onClick={closeCaptcha}
                className="-mt-0.5 -mr-0.5 inline-flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-md text-neutral-50/40 outline-none transition-colors hover:bg-white/8 hover:text-neutral-50/80 focus-visible:ring-2 focus-visible:ring-white/30"
              >
                <svg aria-hidden viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" className="size-3.5">
                  <path d="m4.5 4.5 7 7M11.5 4.5l-7 7" />
                </svg>
              </button>
            </div>

            <motion.div
              key={shakeKey}
              animate={
                reduceMotion || shakeKey === 0
                  ? undefined
                  : { x: [0, -6, 6, -4, 4, -2, 2, 0] }
              }
              transition={{ duration: 0.4, ease: "easeInOut" }}
              className="grid grid-cols-3 gap-1"
            >
              {challenge.tiles.map((tile) => {
                const active = selected.has(tile.id);
                return (
                  <motion.button
                    key={tile.id}
                    type="button"
                    aria-pressed={active}
                    aria-label={tile.icon}
                    onClick={() => toggleTile(tile.id)}
                    whileTap={reduceMotion ? undefined : { scale: 0.92 }}
                    className={cn(
                      "relative flex aspect-square cursor-pointer items-center justify-center rounded-lg outline-none transition-[background-color,box-shadow] duration-150 focus-visible:ring-2 focus-visible:ring-white/30",
                      active
                        ? "bg-white/10 inset-ring-2 inset-ring-neutral-50/80"
                        : "bg-white/4 inset-ring inset-ring-white/6 hover:bg-white/8",
                    )}
                  >
                    <svg
                      aria-hidden
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className={cn(
                        "size-7 transition-[transform,color] duration-150",
                        active
                          ? "scale-90 text-neutral-50"
                          : "text-neutral-50/60",
                      )}
                    >
                      {ICONS[tile.icon]}
                    </svg>
                    <span
                      aria-hidden
                      className={cn(
                        "absolute top-1 left-1 inline-flex size-3.5 items-center justify-center rounded-full bg-neutral-50 text-[#1f1f1f] transition-[opacity,transform] duration-150",
                        active ? "scale-100 opacity-100" : "scale-50 opacity-0",
                      )}
                    >
                      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="size-2.5">
                        <path d="m3.5 8.5 3 3 6-7" />
                      </svg>
                    </span>
                  </motion.button>
                );
              })}
            </motion.div>

            <div className="flex h-7 items-center px-1.5" aria-live="polite">
              <AnimatePresence mode="wait">
                {taunt && (
                  <motion.p
                    key={taunt}
                    initial={reduceMotion ? false : { opacity: 0, y: 2 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="truncate text-[11px] font-medium text-red-400"
                  >
                    {taunt}
                  </motion.p>
                )}
              </AnimatePresence>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                aria-label="New challenge"
                onClick={() => {
                  setTaunt(null);
                  setChallenge(buildChallenge());
                  setSelected(new Set());
                }}
                className="group/refresh inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-neutral-50/45 outline-none inset-ring inset-ring-white/6 transition-colors hover:bg-white/8 hover:text-neutral-50/80 focus-visible:ring-2 focus-visible:ring-white/30"
              >
                <svg aria-hidden viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="size-3.5 transition-transform duration-300 group-hover/refresh:rotate-90 motion-reduce:transform-none">
                  <path d="M13 8a5 5 0 1 1-1.5-3.55" />
                  <path d="M13 2.5v2.5h-2.5" />
                </svg>
              </button>
              <button
                type="button"
                onClick={verify}
                disabled={selected.size === 0}
                className={cn(
                  "h-8 flex-1 cursor-pointer rounded-lg bg-neutral-50 text-xs font-semibold text-neutral-900 outline-none shadow-[0_0_0_1px_rgb(0_0_0/0.9),inset_0_-1px_0_rgb(0_0_0/0.12)] transition-[transform,background-color,opacity] duration-150",
                  "hover:bg-white active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-white/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[#1f1f1f] disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100",
                )}
              >
                Verify
              </button>
            </div>
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
            "group/captcha inline-flex h-9 cursor-pointer items-center justify-center gap-2 rounded-[10px] pr-4 pl-3 text-sm font-medium text-neutral-50 outline-none select-none",
            // Graded dark surface: dark outer hairline, faint inner ring, top highlight, soft drop.
            "bg-linear-to-b from-[#353535] to-[#272727] shadow-[0_0_0_1px_rgb(0_0_0/0.9),inset_0_0_0_1px_rgb(255_255_255/0.06),inset_0_1px_0_rgb(255_255_255/0.14),0_1px_2px_rgb(0_0_0/0.25),0_4px_12px_-4px_rgb(0_0_0/0.4)]",
            "transition-[transform,filter,box-shadow] duration-300 ease-[cubic-bezier(0.34,1.35,0.64,1)] hover:brightness-110 data-[state=open]:brightness-110",
            // Press eases in fast and settles the shadow; release springs back on the slower base curve.
            "active:scale-[0.97] active:brightness-95 active:duration-100 active:ease-out active:shadow-[0_0_0_1px_rgb(0_0_0/0.9),inset_0_0_0_1px_rgb(255_255_255/0.05),inset_0_1px_0_rgb(255_255_255/0.08),0_0_1px_rgb(0_0_0/0.2),0_1px_3px_-2px_rgb(0_0_0/0.3)] motion-reduce:active:scale-100",
            "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50",
            className,
          )}
          {...props}
        >
          <svg
            aria-hidden
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={cn(
              "size-3.5 transition-colors duration-150",
              isSuccess
                ? "text-emerald-400"
                : "text-neutral-50/45 group-hover/captcha:text-neutral-50/75 group-data-[state=open]/captcha:text-neutral-50/75",
            )}
          >
            <path d="M8 1.75 3 3.5v4c0 3.1 2.1 5.5 5 6.75 2.9-1.25 5-3.65 5-6.75v-4L8 1.75Z" />
            {isSuccess ? <path d="m5.75 8 1.6 1.6L10.5 6.4" /> : null}
          </svg>
          <span>{isSuccess ? successLabel : (children ?? label)}</span>
        </button>

        {mounted && createPortal(panel, document.body)}
      </div>
    );
  },
);

CaptchaButton.displayName = "CaptchaButton";

export default CaptchaButton;
