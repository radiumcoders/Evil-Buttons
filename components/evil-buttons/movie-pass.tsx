"use client";

import { ReactNode, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "@/lib/utils";

const colorMap = {
  primary: "bg-primary",
  secondary: "bg-secondary",
  destructive: "bg-destructive",
  accent: "bg-accent",
} as const;

type Color = keyof typeof colorMap;

const textMap: Record<Color, string> = {
  primary: "text-primary-foreground",
  secondary: "text-secondary-foreground",
  destructive: "text-destructive-foreground",
  accent: "text-accent-foreground",
};

function MoviePassButton({
  children,
  className,
  color = "primary",
  icon,
  onClick,
}: {
  children: ReactNode;
  className?: string;
  color?: Color;
  icon?: ReactNode;
  onClick?: () => void;
}) {
  const [torn, setTorn] = useState(false);
  const [animating, setAnimating] = useState(false);

  const bg = colorMap[color];
  const text = textMap[color];

  const handleClick = () => {
    if (animating) return;
    setAnimating(true);
    setTorn(true);

    setTimeout(() => {
      setTorn(false);
      setAnimating(false);
      onClick?.();
    }, 750);
  };

  const labelContent = (
    <>
      <div className="absolute left-0 top-0 w-3 h-3 rounded-full bg-background -translate-x-1/2 -translate-y-1/2" />
      <div className="absolute left-0 bottom-0 w-3 h-3 rounded-full bg-background -translate-x-1/2 translate-y-1/2" />
      <span
        className={cn(
          "relative z-10 font-bold text-sm tracking-wide select-none whitespace-nowrap",
          text,
        )}
      >
        {children}
      </span>
    </>
  );

  return (
    <div
      className={cn(
        "relative inline-flex items-center",
        "[filter:drop-shadow(0_3px_0px_hsl(var(--foreground)/0.2))]",
        "hover:[filter:drop-shadow(0_5px_0px_hsl(var(--foreground)/0.25))]",
        className,
      )}
    >
      {/* Left cap — never moves */}
      <button
        onClick={handleClick}
        className={cn(
          "relative z-10 w-11 h-11 flex items-center justify-center flex-shrink-0 rounded-l-xl cursor-pointer border-none",
          bg,
        )}
        style={{ WebkitTapHighlightColor: "transparent" }}
      >
        <div className="absolute inset-[6px_4px_6px_8px] bg-white/20 rounded-l-md pointer-events-none" />
        {icon && (
          <span className={cn("relative z-10 text-lg leading-none", text)}>
            {icon}
          </span>
        )}
      </button>

      {/* Wrapper — always holds space via the invisible ghost label */}
      <div className="relative h-11">
        {/* Ghost — invisible but always in flow, permanently holds the width */}
        <div
          aria-hidden
          className={cn(
            "invisible flex items-center pl-2.5 pr-5 h-full",
            "border-l-2 border-dashed border-transparent",
          )}
        >
          <span className="font-bold text-sm tracking-wide whitespace-nowrap">
            {children}
          </span>
        </div>

        {/* Animated label — absolute on top of the ghost */}
        <AnimatePresence>
          {!torn && (
            <motion.div
              key="attached"
              exit={{ y: 80, rotate: 20, opacity: 0 }}
              transition={{ duration: 0.55, ease: [0.4, 0, 1, 1] }}
              onClick={handleClick}
              className={cn(
                "absolute inset-0 flex items-center pl-2.5 pr-5 rounded-r-xl cursor-pointer",
                "border-l-2 border-dashed border-white/30",
                bg,
              )}
            >
              {labelContent}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

export default MoviePassButton;
