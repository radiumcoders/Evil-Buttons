"use client";

import { motion } from "motion/react";
import { useState } from "react";
import { cn } from "@/lib/utils";

export default function Shadcn({ className }: { className?: string }) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <motion.button
      className={cn(
        "relative flex items-center justify-center size-14 bg-white rounded-full dark:bg-black border border-neutral-200 dark:border-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer group",
        className
      )}
      onHoverStart={() => setIsHovered(true)}
      onHoverEnd={() => setIsHovered(false)}
      onFocus={() => setIsHovered(true)}
      onBlur={() => setIsHovered(false)}
      whileTap={{ scale: 0.95 }}
      aria-label="shadcn/ui Logo"
    >
      <Logo 
        isHovered={isHovered} 
        className="w-8 h-8 text-black dark:text-white group-hover:scale-90 transition-transform duration-300" 
      />
    </motion.button>
  );
}

const Logo = ({ className, isHovered }: { className?: string; isHovered: boolean }) => {
  return (
    <motion.svg
      viewBox="0 0 256 256"
      className={cn(className)}
      initial="hidden"
      animate={isHovered ? "hover" : "visible"}
    >
      <path fill="none" d="M0 0h256v256H0z" />
      {/* Top right short diagonal line */}
      <motion.path
        fill="none"
        stroke="currentColor"
        strokeWidth="25"
        strokeLinecap="round"
        d="M208 128l-80 80"
        variants={{
          hidden: { pathLength: 0, opacity: 0 },
          visible: {
            pathLength: 1,
            opacity: 1,
            transition: { duration: 1, ease: [0.16, 1, 0.3, 1], delay: 0.1 },
          },
          hover: {
            pathLength: [0, 1],
            opacity: 1,
            transition: {
              duration: 0.6,
              ease: "easeInOut",
            },
          },
        }}
      />
      {/* Long main diagonal line */}
      <motion.path
        fill="none"
        stroke="currentColor"
        strokeWidth="25"
        strokeLinecap="round"
        d="M192 40L40 192"
        variants={{
          hidden: { pathLength: 0, opacity: 0 },
          visible: {
            pathLength: 1,
            opacity: 1,
            transition: { duration: 1.2, ease: [0.16, 1, 0.3, 1] },
          },
          hover: {
            pathLength: [0, 1],
            opacity: 1,
            transition: {
              duration: 0.6,
              ease: "easeInOut",
              delay: 0.15, // Stagger the two lines slightly on hover
            },
          },
        }}
      />
    </motion.svg>
  );
};
