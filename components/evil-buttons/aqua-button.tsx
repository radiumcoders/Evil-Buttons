"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export type AquaButtonVariant = "primary" | "secondary";

export interface AquaButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: AquaButtonVariant;
}

const EASE = "cubic-bezier(0.4, 0, 0.2, 1)";

const VARIANTS = {
  primary: {
    text: "text-[rgb(20,30,55)]",
    textShadow: "0 1px 0 rgba(255, 255, 255, 0.35)",
    bg: "linear-gradient(rgb(95, 160, 230), rgb(50, 115, 205) 55%, rgb(95, 160, 230))",
    shadow:
      "0 0.25em 0.375em rgba(0, 0, 0, 0.25), inset 0 0 0 1px rgba(0, 30, 95, 0.55), inset 0 0.125em 0.25em rgba(0, 20, 80, 0.3)",
    hoverExtra: ", 0 0 0.875em 0.0625em rgba(60, 150, 235, 0.55)",
    focusExtra:
      ", 0 0 0 0.125em rgba(255, 255, 255, 0.95), 0 0 0 0.3125em rgba(40, 150, 255, 0.95), 0 0 1.25em 0.1875em rgba(60, 170, 255, 0.7)",
    active:
      "0 0.0625em 0.125em rgba(0, 0, 0, 0.25), inset 0 0 0 1px rgba(0, 30, 95, 0.65), inset 0 0.25em 0.5em rgba(0, 20, 80, 0.55)",
  },
  secondary: {
    text: "text-[rgb(35,35,40)] dark:text-white",
    textShadow: "var(--aqua-text-shadow)",
    bg: "var(--aqua-bg)",
    shadow: "var(--aqua-shadow)",
    hoverExtra: "",
    focusExtra: "",
    active: "var(--aqua-shadow-active)",
  },
} as const;

const SECONDARY_THEME_CLASSES = [
  "[--aqua-bg:linear-gradient(rgb(225,_226,_228),_rgb(245,_246,_248)_55%,_rgb(230,_230,_232))]",
  "[--aqua-shadow:0_0.25em_0.375em_rgba(0,_0,_0,_0.18),inset_0_0_0_1px_rgba(120,_122,_130,_0.5),inset_0_0.125em_0.25em_rgba(0,_0,_0,_0.15)]",
  "[--aqua-shadow-hover:0_0.25em_0.375em_rgba(0,_0,_0,_0.18),inset_0_0_0_1px_rgba(120,_122,_130,_0.5),inset_0_0.125em_0.25em_rgba(0,_0,_0,_0.15),0_0_0.875em_0.0625em_rgba(0,_0,_0,_0.18)]",
  "[--aqua-shadow-focus:0_0.25em_0.375em_rgba(0,_0,_0,_0.18),inset_0_0_0_1px_rgba(120,_122,_130,_0.5),inset_0_0.125em_0.25em_rgba(0,_0,_0,_0.15),0_0_0_0.125em_rgba(255,_255,_255,_0.95),0_0_0_0.3125em_rgba(40,_150,_255,_0.95),0_0_1.25em_0.1875em_rgba(60,_170,_255,_0.55)]",
  "[--aqua-shadow-active:0_0.0625em_0.125em_rgba(0,_0,_0,_0.18),inset_0_0_0_1px_rgba(120,_122,_130,_0.6),inset_0_0.25em_0.5em_rgba(0,_0,_0,_0.3)]",
  "[--aqua-text-shadow:0_1px_0_rgba(255,_255,_255,_0.7)]",
  "[--aqua-top-highlight:linear-gradient(rgba(255,_255,_255,_0.85),_rgba(255,_255,_255,_0.25))]",
  "[--aqua-bottom-highlight:linear-gradient(rgba(255,_255,_255,_0.15),_rgba(255,_255,_255,_0.5))]",
  "dark:[--aqua-bg:linear-gradient(rgb(40,_40,_45),_rgb(22,_22,_28)_55%,_rgb(40,_40,_45))]",
  "dark:[--aqua-shadow:0_0.25em_0.375em_rgba(0,_0,_0,_0.4),inset_0_0_0_1px_rgba(255,_255,_255,_0.08),inset_0_0.125em_0.25em_rgba(0,_0,_0,_0.3)]",
  "dark:[--aqua-shadow-hover:0_0.25em_0.375em_rgba(0,_0,_0,_0.4),inset_0_0_0_1px_rgba(255,_255,_255,_0.08),inset_0_0.125em_0.25em_rgba(0,_0,_0,_0.3),0_0_0.875em_0.0625em_rgba(100,_100,_255,_0.2)]",
  "dark:[--aqua-shadow-focus:0_0.25em_0.375em_rgba(0,_0,_0,_0.4),inset_0_0_0_1px_rgba(255,_255,_255,_0.08),inset_0_0.125em_0.25em_rgba(0,_0,_0,_0.3),0_0_0_0.125em_rgba(255,_255,_255,_0.95),0_0_0_0.3125em_rgba(100,_120,_255,_0.8),0_0_1.25em_0.1875em_rgba(80,_100,_255,_0.5)]",
  "dark:[--aqua-shadow-active:0_0.0625em_0.125em_rgba(0,_0,_0,_0.4),inset_0_0_0_1px_rgba(255,_255,_255,_0.1),inset_0_0.25em_0.5em_rgba(0,_0,_0,_0.5)]",
  "dark:[--aqua-text-shadow:0_1px_2px_rgba(0,_0,_0,_0.5)]",
  "dark:[--aqua-top-highlight:linear-gradient(rgba(255,_255,_255,_0.12),_rgba(255,_255,_255,_0.03))]",
  "dark:[--aqua-bottom-highlight:linear-gradient(rgba(255,_255,_255,_0.04),_rgba(255,_255,_255,_0.08))]",
] as const;

export const AquaButton = React.forwardRef<HTMLButtonElement, AquaButtonProps>(
  ({ className, variant = "primary", style, children, ...props }, ref) => {
    const v = VARIANTS[variant];
    const isSecondary = variant === "secondary";

    return (
      <button
        ref={ref}
        className={cn(
          "group relative inline-flex h-[1.75em] min-w-[6em] max-w-full cursor-pointer items-center justify-center overflow-hidden rounded-full px-[2em] text-base font-medium outline-none will-change-transform",
          v.text,
          isSecondary && SECONDARY_THEME_CLASSES,
          "transition-[transform,box-shadow] duration-[320ms] [transition-timing-function:var(--aqua-ease)]",
          "hover:-translate-y-px hover:[box-shadow:var(--aqua-shadow-hover)]",
          "focus-visible:-translate-y-px focus-visible:ring-2 focus-visible:ring-white/95 focus-visible:ring-offset-2 focus-visible:ring-offset-sky-500/90 focus-visible:[box-shadow:var(--aqua-shadow-focus)]",
          "active:translate-y-0 active:scale-[0.97] active:duration-[140ms] active:[box-shadow:var(--aqua-shadow-active)]",
          "motion-reduce:transition-none motion-reduce:hover:translate-y-0 motion-reduce:focus-visible:translate-y-0 motion-reduce:active:scale-100",
          className,
        )}
        style={
          {
            background: v.bg,
            "--aqua-ease": EASE,
            ...(isSecondary
              ? {}
              : {
                  "--aqua-shadow": v.shadow,
                  "--aqua-shadow-hover": v.shadow + v.hoverExtra,
                  "--aqua-shadow-focus": v.shadow + v.focusExtra,
                  "--aqua-shadow-active": v.active,
                }),
            boxShadow: "var(--aqua-shadow)",
            ...style,
          } as React.CSSProperties
        }
        {...props}
      >
        <span
          aria-hidden
          className={cn(
            "pointer-events-none absolute left-1/2 top-[6%] z-[2] h-[42%] w-[calc(100%-0.625em)] -translate-x-1/2 rounded-[2em_2em_0.75em_0.75em] opacity-90 blur-[0.5px]",
            "origin-top transition-[opacity,transform] duration-[320ms] [transition-timing-function:var(--aqua-ease)]",
            "group-hover:scale-y-[1.04] group-hover:opacity-100",
            "group-focus-visible:scale-y-[1.04] group-focus-visible:opacity-100",
            "group-active:scale-y-[0.82] group-active:opacity-75 group-active:duration-[140ms]",
            "motion-reduce:transition-none motion-reduce:group-hover:scale-y-100 motion-reduce:group-focus-visible:scale-y-100 motion-reduce:group-active:scale-y-100",
          )}
          style={{
            background: isSecondary
              ? "var(--aqua-top-highlight)"
              : "linear-gradient(rgba(255, 255, 255, 0.85), rgba(255, 255, 255, 0.25))",
          }}
        />
        <span
          aria-hidden
          className={cn(
            "pointer-events-none absolute bottom-[8%] left-1/2 h-[28%] w-[calc(100%-1.25em)] -translate-x-1/2 rounded-[0.75em] opacity-70 blur-[2px]",
            "transition-opacity duration-[320ms] [transition-timing-function:var(--aqua-ease)]",
            "group-hover:opacity-90",
            "group-focus-visible:opacity-90",
            "group-active:opacity-40 group-active:duration-[140ms]",
            "motion-reduce:transition-none",
          )}
          style={{
            background: isSecondary
              ? "var(--aqua-bottom-highlight)"
              : "linear-gradient(rgba(255, 255, 255, 0.15), rgba(255, 255, 255, 0.5))",
          }}
        />
        <span
          className={cn(
            "relative z-[1] tracking-[0.005em]",
            "transition-transform duration-[320ms] [transition-timing-function:var(--aqua-ease)]",
            "group-active:translate-y-[0.5px] group-active:duration-[140ms]",
            "motion-reduce:transition-none motion-reduce:group-active:translate-y-0",
          )}
          style={{ textShadow: v.textShadow }}
        >
          {children}
        </span>
      </button>
    );
  },
);

AquaButton.displayName = "AquaButton";

export default AquaButton;
