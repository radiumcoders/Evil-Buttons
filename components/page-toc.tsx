"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

type Heading = {
  id: string;
  text: string;
  level: number;
};

export function PageToc() {
  const pathname = usePathname();
  const [items, setItems] = useState<Heading[]>([]);
  const [activeId, setActiveId] = useState<string>("");

  useEffect(() => {
    const headings = Array.from(
      document.querySelectorAll<HTMLElement>(".docs-content h2[id], .docs-content h3[id]"),
    ).map((node) => ({
      id: node.id,
      text: node.textContent?.trim() ?? "",
      level: node.tagName === "H2" ? 2 : 3,
    }));

    const rafId = window.requestAnimationFrame(() => {
      setItems(headings);
    });

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);

        if (visible[0]?.target?.id) {
          setActiveId(visible[0].target.id);
        }
      },
      { rootMargin: "0px 0px -70% 0px", threshold: [0, 1] },
    );

    headings.forEach((item) => {
      const element = document.getElementById(item.id);
      if (element) observer.observe(element);
    });

    return () => {
      window.cancelAnimationFrame(rafId);
      observer.disconnect();
    };
  }, [pathname]);

  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">No headings on this page.</p>;
  }

  return (
    <nav className="flex flex-col gap-0.5">
      {items.map((item) => (
        <a
          key={item.id}
          href={`#${item.id}`}
          className={cn(
            "block border-l px-3 py-1 text-sm transition-colors",
            item.level === 3 ? "ml-3" : "",
            activeId === item.id
              ? "border-primary text-foreground"
              : "border-border text-muted-foreground hover:text-foreground",
          )}
        >
          {item.text}
        </a>
      ))}
    </nav>
  );
}
