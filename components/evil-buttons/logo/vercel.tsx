"use client";

import { motion } from "motion/react";
import { useState } from "react";
import { cn } from "@/lib/utils";

export default function Vercel() {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <motion.button
      className="relative flex items-center justify-center size-14 bg-black rounded-full dark:bg-white border border-border shadow-sm overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer"
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      onFocus={() => setIsHovered(true)}
      onBlur={() => setIsHovered(false)}
      whileTap={{ scale: 0.95 }}
      aria-label="Vercel Logo"
    >
      <motion.div
        animate={isHovered ? { x: ["0%", "-50%"] } : { x: "0%" }}
        transition={
          isHovered
            ? { repeat: Infinity, ease: "linear", duration: 1.2 }
            : { duration: 0.4, ease: "easeOut" }
        }
        className="flex w-[400%]"
      >
        {/* We use 4 logos and translate by -50% to create a seamless infinite marquee effect */}
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="w-1/4 flex items-center justify-center">
            {/* The -mt-[3px] optically centers the triangle since its visual weight is bottom-heavy */}
            <Logo className="w-6 h-6 dark:invert -mt-[3px]" />
          </div>
        ))}
      </motion.div>
    </motion.button>
  );
}

const Logo = ({ className }: { className?: string }) => {
  return (
    <svg viewBox="0 0 256 222" preserveAspectRatio="xMidYMid" className={cn(className)}>
      <path fill="#fff" d="m128 0 128 221.705H0z" />
    </svg>
  );
};
