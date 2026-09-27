"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

type Heading = {
  id: string;
  text: string;
  level: number;
};

type TrackGeometry = {
  d: string;
  width: number;
  height: number;
  // Vertical extent of each item, used to position the active thumb.
  spans: { top: number; bottom: number }[];
};

// x offset of the track line for each heading depth.
const TRACK_X: Record<number, number> = { 2: 1, 3: 11 };
// Height of the diagonal joint when the track shifts between depths.
const JOINT = 5;

function buildTrack(anchors: HTMLElement[], levels: number[]): TrackGeometry {
  const spans = anchors.map((anchor) => ({
    top: anchor.offsetTop,
    bottom: anchor.offsetTop + anchor.offsetHeight,
  }));

  let d = "";
  spans.forEach((span, index) => {
    const x = TRACK_X[levels[index]] ?? 1;
    const prevX = index > 0 ? (TRACK_X[levels[index - 1]] ?? 1) : x;
    const nextX =
      index < spans.length - 1 ? (TRACK_X[levels[index + 1]] ?? 1) : x;
    const top = index > 0 && prevX !== x ? span.top + JOINT : span.top;
    const bottom = nextX !== x ? span.bottom - JOINT : span.bottom;

    d += index === 0 ? `M${x} ${top}` : ` L${x} ${top}`;
    d += ` L${x} ${bottom}`;
  });

  return {
    d,
    width: Math.max(...Object.values(TRACK_X)) + 1,
    height: spans.at(-1)?.bottom ?? 0,
    spans,
  };
}

/**
 * Returns the ids of every heading whose section intersects the scroll
 * container's viewport, so the thumb can cover the whole visible range.
 */
function getVisibleIds(container: HTMLElement, ids: string[]): string[] {
  const view = container.getBoundingClientRect();
  const viewTop = view.top + 64;
  const viewBottom = view.bottom;
  const elements = ids
    .map((id) => document.getElementById(id))
    .filter((element): element is HTMLElement => element !== null);

  const visible = elements
    .filter((element, index) => {
      const start = element.getBoundingClientRect().top;
      const next = elements[index + 1];
      const end = next
        ? next.getBoundingClientRect().top
        : container.scrollHeight;
      return start < viewBottom && end > viewTop;
    })
    .map((element) => element.id);

  if (visible.length > 0) return visible;

  // Between headings (e.g. the intro above the first one): keep the last
  // heading that has scrolled past, or nothing if none has.
  const passed = elements.filter(
    (element) => element.getBoundingClientRect().top < viewTop,
  );
  return passed.length > 0 ? [passed[passed.length - 1].id] : [];
}

export function PageToc() {
  const pathname = usePathname();
  const [items, setItems] = useState<Heading[]>([]);
  const [activeIds, setActiveIds] = useState<string[]>([]);
  const [track, setTrack] = useState<TrackGeometry | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const headings = Array.from(
      document.querySelectorAll<HTMLElement>(
        ".docs-content h2[id], .docs-content h3[id]",
      ),
    ).map((node) => ({
      id: node.id,
      text: node.textContent?.trim() ?? "",
      level: node.tagName === "H2" ? 2 : 3,
    }));

    const rafId = window.requestAnimationFrame(() => {
      setItems(headings);
    });

    const container =
      document.querySelector<HTMLElement>("[data-docs-scroll]") ??
      document.documentElement;
    const ids = headings.map((heading) => heading.id);

    let frame = 0;
    const update = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        const next = getVisibleIds(container, ids);
        setActiveIds((prev) =>
          prev.length === next.length && prev.every((id, i) => id === next[i])
            ? prev
            : next,
        );
      });
    };

    update();
    container.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);

    return () => {
      window.cancelAnimationFrame(rafId);
      window.cancelAnimationFrame(frame);
      container.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [pathname]);

  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list || items.length === 0) return;

    const measure = () => {
      const anchors = Array.from(list.querySelectorAll<HTMLElement>("a"));
      setTrack(
        buildTrack(
          anchors,
          items.map((item) => item.level),
        ),
      );
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(list);
    return () => observer.disconnect();
  }, [items]);

  if (items.length === 0) {
    return (
      <p className="text-[13px] text-muted-foreground">No headings on this page.</p>
    );
  }

  const activeIndexes = items
    .map((item, index) => (activeIds.includes(item.id) ? index : -1))
    .filter((index) => index !== -1);
  const firstSpan = track?.spans[activeIndexes[0]];
  const lastSpan = track?.spans[activeIndexes[activeIndexes.length - 1]];
  const thumb =
    track && firstSpan && lastSpan
      ? { top: firstSpan.top, bottom: track.height - lastSpan.bottom }
      : null;

  return (
    <div ref={listRef} className="relative">
      {track ? (
        <>
          <svg
            aria-hidden
            width={track.width}
            height={track.height}
            viewBox={`0 0 ${track.width} ${track.height}`}
            className="pointer-events-none absolute top-0 left-0 text-border"
          >
            <path
              d={track.d}
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
              strokeLinejoin="round"
            />
          </svg>
          <svg
            aria-hidden
            width={track.width}
            height={track.height}
            viewBox={`0 0 ${track.width} ${track.height}`}
            className="pointer-events-none absolute top-0 left-0 text-brand transition-[clip-path,opacity] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
            style={{
              clipPath: thumb
                ? `inset(${thumb.top}px 0 ${thumb.bottom}px 0)`
                : `inset(0 0 ${track.height}px 0)`,
              opacity: thumb ? 1 : 0,
            }}
          >
            <path
              d={track.d}
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          </svg>
        </>
      ) : null}
      <nav aria-label="On this page" className="flex flex-col">
        {items.map((item) => {
          const active = activeIds.includes(item.id);

          return (
            <a
              key={item.id}
              href={`#${item.id}`}
              aria-current={active ? "location" : undefined}
              className={cn(
                "block py-1.5 text-[13px] leading-snug transition-colors duration-300 focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                item.level === 3 ? "pl-7" : "pl-4",
                active
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {item.text}
            </a>
          );
        })}
      </nav>
    </div>
  );
}
