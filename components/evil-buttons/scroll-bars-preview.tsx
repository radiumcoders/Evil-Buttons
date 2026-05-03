"use client";

import { useRef } from "react";
import { useScroll } from "motion/react";
import { ScrollBars, ScrollBarsVertical } from "./scroll-bars";

export function ScrollBarsPreview() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    container: containerRef,
  });

  return (
    <div
      ref={containerRef}
      className="relative h-80 w-full overflow-y-auto overscroll-contain"
    >
      <div className="relative h-[300vh] w-full">
        <div className="sticky top-0 h-80 flex items-center justify-center">
          <ScrollBars
            scrollYProgress={scrollYProgress}
            rounded
            accentClassName="dark:bg-orange-600 bg-orange-500"
          />
        </div>
      </div>
    </div>
  );
}

export function ScrollBarsVerticalPreview() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    container: containerRef,
  });

  return (
    <div
      ref={containerRef}
      className="relative h-80 w-full overflow-y-auto overscroll-contain"
    >
      <div className="relative h-[300vh] w-full">
        <div className="sticky top-0 h-80 flex items-center justify-center">
          <ScrollBarsVertical scrollYProgress={scrollYProgress} />
        </div>
      </div>
    </div>
  );
}