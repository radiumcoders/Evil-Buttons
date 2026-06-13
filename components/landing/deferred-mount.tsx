"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";

/**
 * Renders `placeholder` until the wrapper scrolls within `rootMargin` of the
 * viewport, then mounts `children`; when it scrolls far away again it returns
 * to the placeholder, unmounting `children`. Used on the landing grid to keep
 * the always-on WebGL buttons (Chrome, EvilEye) from running their render
 * loops while off-screen. Landing-only — never import this from a registry
 * component.
 */
export function DeferredMount({
  children,
  placeholder = null,
  rootMargin = "200px",
}: {
  children: ReactNode;
  placeholder?: ReactNode;
  rootMargin?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => setVisible(entry.isIntersecting),
      { rootMargin },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [rootMargin]);

  return (
    <div ref={ref} className="flex h-full w-full items-center justify-center">
      {visible ? children : placeholder}
    </div>
  );
}
