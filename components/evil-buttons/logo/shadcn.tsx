"use client";

import { motion } from "motion/react";
import { cn } from "@/lib/utils";

export default function Shadcn() {
  return (
    <motion.button
      className="relative flex items-center justify-center size-14 bg-white rounded-xl dark:bg-black border border-neutral-200 dark:border-neutral-800 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer group"
      whileHover="hover"
      whileTap="tap"
      aria-label="shadcn/ui Logo"
    >
      <Logo className="w-8 h-8 text-black dark:text-white group-hover:scale-90 transition-transform duration-300" />
    </motion.button>
  );
}

const Logo = ({ className }: { className?: string }) => {
  return (
    <motion.svg
      viewBox="0 0 256 256"
      className={cn(className)}
      initial="hidden"
      animate="visible"
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
            pathLength: [1, 0, 1],
            pathOffset: [0, 1, 0],
            transition: {
              duration: 0.8,
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
            pathLength: [1, 0, 1],
            pathOffset: [0, 1, 0],
            transition: {
              duration: 0.8,
              ease: "easeInOut",
              delay: 0.1, // Stagger the two lines slightly on hover
            },
          },
        }}
      />
    </motion.svg>
  );
};
