"use client";

import { cn } from "@/lib/utils";
import { motion } from "motion/react";
import { useState } from "react";

export const ClickPowerUp = ({
  children,
  className,
  tapDuration = 500,
}: {
  children: React.ReactNode;
  className?: string;
  tapDuration?: number;
}) => {
  const [isTapped, setIsTapped] = useState(false);

  const handleTap = () => {
    if (isTapped) return;
    setIsTapped(true);
    setTimeout(() => setIsTapped(false), tapDuration);
  };

  const state = isTapped ? "tap" : "rest";

  return (
    <motion.div
      initial="rest"
      animate={state}
      whileHover={isTapped ? "tap" : "hover"}
      onTap={handleTap}
      className="relative inline-block cursor-pointer [--pattern:var(--color-neutral-200)] dark:[--pattern:var(--color-neutral-900)]"
    >
      {/* Corner brackets */}
      {[
        {
          corner: "top-right",
          cls: "absolute top-0 right-0 size-2 border-t border-r z-20",
        },
        {
          corner: "top-left",
          cls: "absolute top-0 left-0 size-2 border-t border-l z-20",
        },
        {
          corner: "bottom-left",
          cls: "absolute bottom-0 left-0 size-2 border-b border-l z-20",
        },
        {
          corner: "bottom-right",
          cls: "absolute right-0 bottom-0 size-2 border-r border-b z-20",
        },
      ].map(({ corner, cls }) => (
        <motion.div
          key={corner}
          custom={corner}
          variants={{
            rest: () => ({ x: 0, y: 0, borderColor: "rgb(38 38 38)" }),
            hover: (c: string) => ({
              x: c.includes("right") ? 3 : -3,
              y: c.includes("bottom") ? 3 : -3,
              borderColor: "rgb(38 38 38)",
            }),
            tap: (c: string) => ({
              x: c.includes("right") ? -2 : 2,
              y: c.includes("bottom") ? -2 : 2,
              borderColor: "#2CD4BD",
            }),
          }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
          className={cls}
        />
      ))}

      <button
        className={cn(
          "relative overflow-hidden px-10 py-3 font-medium uppercase",
          className,
        )}
      >
        {/* Pattern */}
        <span className="absolute inset-0 z-0 bg-[repeating-linear-gradient(315deg,var(--pattern)_0,var(--pattern)_1px,transparent_0,transparent_50%)] bg-size-[7px_7px]" />

        {/* Arm panel */}
        <motion.span
          variants={{
            rest: { scaleX: 0, originX: 0, backgroundColor: "#171717" },
            hover: { scaleX: 1, originX: 0, backgroundColor: "#171717" },
            tap: { scaleX: 1, originX: 0, backgroundColor: "#2CD4BD" },
          }}
          transition={{ type: "spring", stiffness: 220, damping: 22 }}
          className="absolute inset-0 z-10 origin-left"
        />

        {/* Text */}
        <motion.span
          variants={{
            rest: { color: "var(--color-foreground)" },
            hover: { color: "#ffffff" },
            tap: { color: "#0a2926" },
          }}
          transition={{ type: "spring", stiffness: 220, damping: 22 }}
          className="relative z-20"
        >
          {children}
        </motion.span>
      </button>
    </motion.div>
  );
};
