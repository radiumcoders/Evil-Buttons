import { useSyncExternalStore } from "react";

let open = false;
const listeners = new Set<() => void>();

export function setEggHuntOpen(next: boolean) {
  open = next;
  listeners.forEach((listener) => listener());
}

export function openEggHunt() {
  setEggHuntOpen(true);
}

export function useEggHuntOpen() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => open,
    () => false,
  );
}
