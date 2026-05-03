"use client";

import { motion, AnimatePresence } from "motion/react";
import { useState } from "react";
import { cn } from "@/lib/utils";

export default function Vercel() {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <button
      className="group relative flex items-center justify-center w-32 h-32 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-full cursor-pointer"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onFocus={() => setIsHovered(true)}
      onBlur={() => setIsHovered(false)}
      aria-label="Vercel Logo"
    >
      <AnimatePresence>
        {isHovered && (
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.5 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="absolute inset-0 z-0 flex items-center justify-center pointer-events-none"
          >
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, ease: "linear", duration: 8 }}
              className="flex items-center justify-center size-[110px] rounded-full border border-dashed border-neutral-300 dark:border-neutral-700"
            >
              {[0, 120, 240].map((deg, i) => (
                <div
                  key={i}
                  className="absolute"
                  style={{
                    transform: `rotate(${deg}deg) translateY(-55px)`,
                  }}
                >
                  <Logo className="w-4 h-4 text-neutral-600 dark:text-neutral-400" />
                </div>
              ))}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div
        whileTap={{ scale: 0.9 }}
        className="relative z-10 flex items-center justify-center size-14 bg-black rounded-full dark:bg-white border border-neutral-800 dark:border-neutral-200 shadow-sm"
      >
        <Logo className="w-6 h-6 text-white dark:text-black -mt-[3px]" />
      </motion.div>
    </button>
  );
}

const Logo = ({ className }: { className?: string }) => {
  return (
    <svg viewBox="0 0 256 222" preserveAspectRatio="xMidYMid" className={cn(className)}>
      <path fill="currentColor" d="m128 0 128 221.705H0z" />
    </svg>
  );
};
