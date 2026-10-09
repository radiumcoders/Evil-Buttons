"use client";

import { useEffect, useRef, useState } from "react";
import { showcase } from "@/components/landing/showcase";
import { findEgg } from "./eggs";
import { onEgg } from "./triggers";

const LINE_MS = 55;
const HOLD_DELETED = 1400;
const RESTORE_MS = 1600;

type Phase = "deleting" | "deleted" | "restoring";

function deletionLog() {
  const files = showcase.map(
    (component) => `removed 'components/evil-buttons/${component.registryName}.tsx'`,
  );
  return [
    "$ sudo rm -rf --no-preserve-root ./everything",
    ...files,
    "removed 'app/page.tsx'",
    "removed 'app/docs'",
    "removed 'your-confidence.txt'",
    "removed directory './everything'",
  ];
}

/** Get through every doubt on the DoubtButton and it really does delete everything. Briefly. */
export function EverythingDeleted() {
  const [phase, setPhase] = useState<Phase | null>(null);
  const [lines, setLines] = useState(0);
  const [log] = useState(deletionLog);
  const restoreButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(
    () =>
      onEgg("deleted", () => {
        setLines(0);
        setPhase((current) => current ?? "deleting");
      }),
    [],
  );

  useEffect(() => {
    if (phase === "deleting") {
      let count = 0;
      const interval = window.setInterval(() => {
        count += 1;
        setLines(count);
        if (count >= log.length) {
          window.clearInterval(interval);
          setPhase("deleted");
        }
      }, LINE_MS);
      return () => window.clearInterval(interval);
    }
    if (phase === "deleted") {
      findEgg("deleted", { title: "You were sure.", note: "Everything is gone. Mostly." });
      restoreButtonRef.current?.focus({ preventScroll: true });
      const timeout = window.setTimeout(() => setPhase("restoring"), HOLD_DELETED + 2200);
      return () => window.clearTimeout(timeout);
    }
    if (phase === "restoring") {
      const timeout = window.setTimeout(() => setPhase(null), RESTORE_MS);
      return () => window.clearTimeout(timeout);
    }
  }, [phase, log.length]);

  useEffect(() => {
    if (!phase) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPhase("restoring");
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [phase]);

  if (!phase) return null;
  return (
    <div
      role="alertdialog"
      aria-label="Everything deleted"
      data-phase={phase}
      className="everything-deleted fixed inset-0 z-[2147482600] flex flex-col bg-neutral-950 p-6 font-mono text-[13px] text-neutral-300 sm:p-10"
    >
      {phase === "deleting" ? (
        <div className="flex min-h-0 flex-1 flex-col justify-end overflow-hidden">
          {log.slice(0, lines).map((line, index) => (
            <p key={index} className={index === 0 ? "text-brand" : undefined}>
              {line}
            </p>
          ))}
        </div>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
          <p className="font-pixel-display text-4xl text-neutral-50 sm:text-6xl">
            {phase === "deleted" ? "Everything deleted." : "Restoring from backup…"}
          </p>
          {phase === "deleted" ? (
            <>
              <p className="text-neutral-500">You were warned. Several times.</p>
              <button
                ref={restoreButtonRef}
                type="button"
                onClick={() => setPhase("restoring")}
                className="mt-4 rounded-full bg-neutral-50 px-5 py-2 font-sans text-sm font-medium text-neutral-950 transition hover:bg-white focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-950 focus-visible:outline-none"
              >
                Restore from backup
              </button>
            </>
          ) : (
            <div className="h-1 w-64 overflow-hidden rounded-full bg-neutral-800">
              <div className="everything-deleted-progress h-full rounded-full bg-brand" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
