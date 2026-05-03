"use client";

import { motion, AnimatePresence } from "motion/react";
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
      <AnimatePresence mode="popLayout" initial={false}>
        {!isHovered ? (
          <motion.div
            key="static-logo"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 20, opacity: 0 }}
            transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
            className="absolute inset-0 flex items-center justify-center pt-0.5"
          >
            <Logo className="w-6 h-6 dark:invert" />
          </motion.div>
        ) : (
          <motion.div
            key="hover-logo"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 20, opacity: 0 }}
            transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
            className="absolute inset-0 flex items-center justify-center pt-0.5"
          >
            <Logo className="w-6 h-6 dark:invert" />
          </motion.div>
        )}
      </AnimatePresence>
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
