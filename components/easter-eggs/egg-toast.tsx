"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useSyncExternalStore } from "react";

type Toast = {
  key: number;
  title: string;
  note?: string;
  found: number;
  total: number;
};

const DISMISS_AFTER = 4200;

let current: Toast | null = null;
let nextKey = 0;
const listeners = new Set<() => void>();

function emit(toast: Toast | null) {
  current = toast;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function showEggToast(toast: Omit<Toast, "key">) {
  emit({ ...toast, key: nextKey++ });
}

export function EggToaster() {
  const toast = useSyncExternalStore(
    subscribe,
    () => current,
    () => null,
  );

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => {
      if (current?.key === toast.key) emit(null);
    }, DISMISS_AFTER);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-6 z-[2147483100] flex justify-center px-4"
    >
      <AnimatePresence>
        {toast ? (
          <motion.div
            key={toast.key}
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 420, damping: 32 }}
            className="flex max-w-md items-center gap-3 rounded-full bg-neutral-950/95 py-2 pr-4 pl-2.5 text-neutral-50 shadow-[0_0_0_1px_rgb(255_255_255/0.08),0_12px_32px_-8px_rgb(0_0_0/0.6),0_0_24px_-6px_rgb(230_40_40/0.5)] backdrop-blur"
          >
            <span className="flex h-7 shrink-0 items-center rounded-full bg-brand px-2.5 font-pixel-display text-xs text-white tabular-nums">
              {toast.found}/{toast.total}
            </span>
            <span className="min-w-0 text-sm leading-tight">
              <span className="font-medium">{toast.title}</span>
              {toast.note ? (
                <span className="text-neutral-400"> {toast.note}</span>
              ) : null}
            </span>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
