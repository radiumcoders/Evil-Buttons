"use client";

import {
    useEffect,
    useRef,
    useState,
    useSyncExternalStore,
    type ButtonHTMLAttributes,
    type CSSProperties,
    type MouseEvent,
} from "react";
import { cn } from "@/lib/utils";

const STYLES = `
@keyframes eb-glitch-1 {
  0%   { clip-path: inset(31% 0 40% 0); transform: translate(calc(-3px * var(--eb-shift, 1)), 0); }
  20%  { clip-path: inset(76% 0  5% 0); transform: translate(calc( 3px * var(--eb-shift, 1)), 0); }
  40%  { clip-path: inset(10% 0 63% 0); transform: translate(calc(-2px * var(--eb-shift, 1)), 0); }
  60%  { clip-path: inset(55% 0 18% 0); transform: translate(calc( 4px * var(--eb-shift, 1)), 0); }
  80%  { clip-path: inset( 2% 0 84% 0); transform: translate(calc(-3px * var(--eb-shift, 1)), 0); }
  100% { clip-path: inset(31% 0 40% 0); transform: translate(calc(-3px * var(--eb-shift, 1)), 0); }
}
@keyframes eb-glitch-2 {
  0%   { clip-path: inset(60% 0 10% 0); transform: translate(calc( 2px * var(--eb-shift, 1)), 0); }
  20%  { clip-path: inset(14% 0 52% 0); transform: translate(calc(-4px * var(--eb-shift, 1)), 0); }
  40%  { clip-path: inset(82% 0  3% 0); transform: translate(calc( 2px * var(--eb-shift, 1)), 0); }
  60%  { clip-path: inset(25% 0 45% 0); transform: translate(calc(-3px * var(--eb-shift, 1)), 0); }
  80%  { clip-path: inset( 6% 0 70% 0); transform: translate(calc( 3px * var(--eb-shift, 1)), 0); }
  100% { clip-path: inset(60% 0 10% 0); transform: translate(calc( 2px * var(--eb-shift, 1)), 0); }
}
@keyframes eb-glitch-shake {
  0%, 100% { transform: translate(0, 0); }
  15%      { transform: translate(calc(-2px * var(--eb-shift, 1)), calc( 1px * var(--eb-shift, 1))); }
  35%      { transform: translate(calc( 2px * var(--eb-shift, 1)), calc(-1px * var(--eb-shift, 1))); }
  55%      { transform: translate(calc(-1px * var(--eb-shift, 1)), calc( 2px * var(--eb-shift, 1))); }
  75%      { transform: translate(calc( 1px * var(--eb-shift, 1)), calc(-2px * var(--eb-shift, 1))); }
  90%      { transform: translate(calc(-2px * var(--eb-shift, 1)), 0); }
}
@keyframes eb-glitch-flicker {
  0%, 18%, 22%, 25%, 53%, 57%, 100% { opacity: 1; }
  19%, 23%, 54%, 56%                { opacity: 0.35; }
}
`;

function injectKeyframes() {
    if (typeof document === "undefined") return;
    if (document.querySelector("style[data-eb-glitch]")) return;
    const el = document.createElement("style");
    el.setAttribute("data-eb-glitch", "");
    el.textContent = STYLES;
    document.head.appendChild(el);
}

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

function subscribeReducedMotion(callback: () => void) {
    const query = window.matchMedia(REDUCED_MOTION_QUERY);
    query.addEventListener("change", callback);
    return () => query.removeEventListener("change", callback);
}

function usePrefersReducedMotion() {
    return useSyncExternalStore(
        subscribeReducedMotion,
        () => window.matchMedia(REDUCED_MOTION_QUERY).matches,
        () => false,
    );
}

/** When the glitch fires: timed bursts, only on hover, or continuously. */
export type GlitchTrigger = "auto" | "hover" | "always";

const DEFAULT_COLORS: [string, string] = ["#ef4444", "#22d3ee"];

export type GlitchButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
    /** Base milliseconds between automatic glitch bursts (±20% random jitter). Used when `trigger` is `"auto"`. */
    glitchInterval?: number;
    /** Duration in milliseconds of a single glitch burst. */
    glitchDuration?: number;
    /** The two RGB-split channel colors, `[channelA, channelB]`. */
    colors?: [string, string];
    /** Multiplier on the channel and shake displacement. Higher is more violent. */
    intensity?: number;
    /** When the glitch fires. */
    trigger?: GlitchTrigger;
    /** Toggle the scanline overlay. */
    scanlines?: boolean;
};

export function GlitchButton({
    children,
    className,
    glitchInterval = 3500,
    glitchDuration = 450,
    colors = DEFAULT_COLORS,
    intensity = 1,
    trigger = "hover",
    scanlines = true,
    style,
    onMouseEnter,
    onMouseLeave,
    ...props
}: GlitchButtonProps) {
    const reduceMotion = usePrefersReducedMotion();
    const [bursting, setBursting] = useState(false);
    const [hovered, setHovered] = useState(false);
    const hoverRef = useRef(false);

    useEffect(() => {
        injectKeyframes();
        if (reduceMotion || trigger !== "auto") return;

        let offTimer: ReturnType<typeof setTimeout> | undefined;
        let nextTimer: ReturnType<typeof setTimeout> | undefined;

        const schedule = () => {
            const jitter = (Math.random() - 0.5) * glitchInterval * 0.4;
            nextTimer = setTimeout(() => {
                if (hoverRef.current) {
                    schedule();
                    return;
                }
                setBursting(true);
                offTimer = setTimeout(() => {
                    setBursting(false);
                    schedule();
                }, glitchDuration);
            }, glitchInterval + jitter);
        };

        schedule();

        return () => {
            clearTimeout(offTimer);
            clearTimeout(nextTimer);
        };
    }, [trigger, glitchInterval, glitchDuration, reduceMotion]);

    const hoverDriven = trigger !== "always";

    const handleMouseEnter = (event: MouseEvent<HTMLButtonElement>) => {
        if (hoverDriven && !reduceMotion) {
            hoverRef.current = true;
            setHovered(true);
        }
        onMouseEnter?.(event);
    };

    const handleMouseLeave = (event: MouseEvent<HTMLButtonElement>) => {
        if (hoverDriven && !reduceMotion) {
            hoverRef.current = false;
            setHovered(false);
            setBursting(false);
        }
        onMouseLeave?.(event);
    };

    const active = reduceMotion
        ? false
        : trigger === "always"
            ? true
            : trigger === "hover"
                ? hovered
                : bursting || hovered;

    const burst = `${Math.round(glitchDuration * 0.7)}ms`;
    const [channelA, channelB] = colors;

    const rootStyle = {
        isolation: "isolate",
        "--eb-shift": intensity,
        animation: active ? `eb-glitch-shake ${burst} linear infinite` : undefined,
        ...style,
    } as CSSProperties;

    return (
        <button
            {...props}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            className={cn(
                "relative inline-flex h-9 cursor-pointer items-center justify-center overflow-hidden rounded-[10px] px-6 font-mono text-xs font-semibold tracking-widest text-neutral-50 uppercase select-none",
                // Graded dark surface: dark outer hairline, faint inner ring, top highlight, soft drop.
                "bg-linear-to-b from-[#353535] to-[#272727] shadow-[0_0_0_1px_rgb(0_0_0/0.9),inset_0_0_0_1px_rgb(255_255_255/0.06),inset_0_1px_0_rgb(255_255_255/0.14),0_1px_2px_rgb(0_0_0/0.25),0_4px_12px_-4px_rgb(0_0_0/0.4)]",
                // The glitch shake keyframes own `transform`, so the press animates the separate `scale` property.
                "transition-[scale,filter,box-shadow] duration-300 ease-[cubic-bezier(0.34,1.35,0.64,1)] hover:brightness-110",
                // Press eases in fast and settles the shadow; release springs back on the slower base curve.
                "active:scale-[0.97] active:brightness-95 active:duration-100 active:ease-out active:shadow-[0_0_0_1px_rgb(0_0_0/0.9),inset_0_0_0_1px_rgb(255_255_255/0.05),inset_0_1px_0_rgb(255_255_255/0.08),0_0_1px_rgb(0_0_0/0.2),0_1px_3px_-2px_rgb(0_0_0/0.3)] motion-reduce:active:scale-100",
                "outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50",
                className,
            )}
            style={rootStyle}
        >
            <span
                aria-hidden
                className="pointer-events-none absolute inset-0 flex items-center justify-center px-6 font-mono text-xs font-semibold tracking-widest uppercase"
            >
                <span
                    style={{
                        color: channelA,
                        mixBlendMode: "screen",
                        animation: active ? `eb-glitch-1 ${burst} steps(1) infinite` : undefined,
                    }}
                >
                    {children}
                </span>
            </span>

            <span
                aria-hidden
                className="pointer-events-none absolute inset-0 flex items-center justify-center px-6 font-mono text-xs font-semibold tracking-widest uppercase"
            >
                <span
                    style={{
                        color: channelB,
                        mixBlendMode: "screen",
                        animation: active ? `eb-glitch-2 ${burst} steps(1) infinite` : undefined,
                    }}
                >
                    {children}
                </span>
            </span>

            {scanlines ? (
                <span
                    aria-hidden
                    className="pointer-events-none absolute inset-0 bg-[repeating-linear-gradient(0deg,transparent,transparent_2px,rgba(0,0,0,0.1)_2px,rgba(0,0,0,0.1)_4px)]"
                />
            ) : null}

            <span
                className="relative z-10"
                style={{
                    animation: active ? `eb-glitch-flicker ${burst} linear infinite` : undefined,
                }}
            >
                {children}
            </span>
        </button>
    );
}

export default GlitchButton;
