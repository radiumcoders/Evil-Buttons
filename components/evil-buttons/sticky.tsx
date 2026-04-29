"use client";

import { cn } from "@/lib/utils";
import { motion } from "motion/react";
import { ReactNode, useRef, useState } from "react";

function StickyButton({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLButtonElement | null>(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });

  const mouseMove = (e: React.MouseEvent) => {
    if (!ref.current) return;
    const { clientX, clientY } = e;
    const { height, width, left, top } = ref.current.getBoundingClientRect();

    const centerX = (clientX - (left + width / 2)) * 0.4;
    const centerY = (clientY - (top + height / 2)) * 0.4;
    setPosition({ x: centerX, y: centerY });
  };

  const mouseLeave = () => {
    setPosition({ x: 0, y: 0 });
  };

  const { x, y } = position;

  return (
    <motion.button
      onMouseMove={mouseMove}
      onMouseLeave={mouseLeave}
      ref={ref}
      animate={{ x, y }}
      transition={{
        type: "spring",
        stiffness: 200,
        damping: 20,
        mass: 0.5,
      }}
      className={cn(
        "border-border border-dashed border-2 bg-background text-primary rounded px-4 py-2",
        className,
      )}
    >
      {children}
    </motion.button>
  );
}

export default StickyButton;
