"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface ShinyButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Milliseconds the glint takes to sweep across on click. */
  shineDuration?: number;
}

const ShinyButton = React.forwardRef<HTMLButtonElement, ShinyButtonProps>(
  (
    {
      children,
      className,
      shineDuration = 650,
      onClick,
      type = "button",
      ...props
    },
    ref,
  ) => {
    const shineRef = React.useRef<HTMLSpanElement>(null);
    const faceRef = React.useRef<HTMLSpanElement>(null);

    const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
      onClick?.(event);
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

      // Web Animations restart cleanly on every click, even mid-sweep.
      shineRef.current?.animate(
        [
          { transform: "translateX(-160%) skewX(-20deg)", opacity: 0 },
          { opacity: 1, offset: 0.15 },
          { opacity: 1, offset: 0.7 },
          { transform: "translateX(420%) skewX(-20deg)", opacity: 0 },
        ],
        { duration: shineDuration, easing: "cubic-bezier(0.4, 0, 0.2, 1)" },
      );
      faceRef.current?.animate(
        [
          { filter: "brightness(1)" },
          { filter: "brightness(1.25)", offset: 0.25 },
          { filter: "brightness(1)" },
        ],
        { duration: shineDuration * 0.8, easing: "ease-out" },
      );
    };

    return (
      <button
        ref={ref}
        type={type}
        onClick={handleClick}
        className={cn(
          "group/shiny relative inline-flex cursor-pointer rounded-2xl bg-linear-0 from-indigo-500 to-indigo-800 p-1 text-sm font-medium text-white shadow-[0_1px_2px_rgb(0_0_0/0.2),0_4px_12px_-2px_rgb(67_56_202/0.45)] outline-none select-none transition-[transform,box-shadow] duration-100",
          "active:translate-y-0.5 active:scale-[0.99] active:shadow-[0_1px_1px_rgb(0_0_0/0.2),0_2px_6px_-2px_rgb(67_56_202/0.4)]",
          "focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50",
          className,
        )}
        {...props}
      >
        <span
          ref={faceRef}
          className="relative inline-flex items-center gap-1.5 overflow-hidden rounded-xl bg-linear-0 from-indigo-600 to-indigo-700 px-3 py-1 group-active/shiny:shadow-[inset_0_0_3px_0_#4338ca]"
        >
          <span className="relative">{children}</span>
        </span>
        {/* Glint that sweeps across the rim and face on click. */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]"
        >
          <span
            ref={shineRef}
            className="absolute inset-y-0 left-0 w-1/3 bg-linear-to-r from-transparent via-white/55 to-transparent opacity-0"
          />
        </span>
      </button>
    );
  },
);

ShinyButton.displayName = "ShinyButton";

export { ShinyButton };
export default ShinyButton;
