"use client";

import { usePathname } from "next/navigation";
import { counterpart, counterpartUrl } from "@/lib/counterpart";

const segment =
  "flex h-7 items-center justify-center rounded-md text-[12px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring";

/** React | GPUI switch at the top of the docs sidebar; the other side keeps the current button. */
export function FrameworkSwitch() {
  const pathname = usePathname();
  const other = (
    <a
      href={counterpartUrl(pathname)}
      className={`${segment} text-sidebar-foreground/55 hover:text-sidebar-accent-foreground`}
    >
      {counterpart.name}
    </a>
  );
  const current = (
    <span aria-current="page" className={`${segment} bg-sidebar-accent text-sidebar-accent-foreground shadow-xs`}>
      {counterpart.here}
    </span>
  );

  return (
    <div
      role="group"
      aria-label="Framework"
      className="mx-4 mb-2 grid shrink-0 grid-cols-2 gap-0.5 rounded-lg border border-border p-0.5"
    >
      {/* React always sits on the left, GPUI on the right. */}
      {counterpart.here === "React" ? (
        <>
          {current}
          {other}
        </>
      ) : (
        <>
          {other}
          {current}
        </>
      )}
    </div>
  );
}
