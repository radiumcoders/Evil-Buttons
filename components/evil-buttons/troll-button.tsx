"use client";
import { Button } from "@/components/ui/button";
import { motion, useMotionValue } from "motion/react";
import { ReactNode, useEffect, useRef } from "react";

const MotionButton = motion.create(Button);

function TrollButton({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLButtonElement>(null);

  const x = useMotionValue(0);
  const y = useMotionValue(0);

  useEffect(() => {
    const btn = ref.current;
    if (!btn) return;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = btn.getBoundingClientRect();

      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      const dx = e.clientX - centerX;
      const dy = e.clientY - centerY;
      const distance = Math.sqrt(dx * dx + dy * dy);

      // Start fleeing when cursor is within 120px of button center
      if (distance < 120) {
        const strength = 180;
        x.jump(-(dx / distance) * strength);
        y.jump(-(dy / distance) * strength);
      } else {
        x.jump(0);
        y.jump(0);
      }
    };

    document.addEventListener("mousemove", handleMouseMove);
    return () => document.removeEventListener("mousemove", handleMouseMove);
  }, [x, y]);

  return (
    <MotionButton
      ref={ref}
      variant="destructive"
      style={{ x, y, position: "relative" }}
    >
      {children}
    </MotionButton>
  );
}

export default TrollButton;
