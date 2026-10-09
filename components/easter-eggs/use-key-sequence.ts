import { useEffect, useRef } from "react";
import { isEditableTarget } from "./eggs";

/** Calls `onMatch` when `sequence` (`KeyboardEvent.key` values, letters lowercase) is typed outside inputs. */
export function useKeySequence(sequence: readonly string[], onMatch: () => void) {
  const onMatchRef = useRef(onMatch);
  useEffect(() => {
    onMatchRef.current = onMatch;
  }, [onMatch]);

  useEffect(() => {
    let progress = 0;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.isComposing || event.metaKey || event.ctrlKey || event.altKey) return;
      if (isEditableTarget(event.target)) return;
      const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
      if (key === sequence[progress]) progress += 1;
      else progress = key === sequence[0] ? 1 : 0;
      if (progress === sequence.length) {
        progress = 0;
        onMatchRef.current();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [sequence]);
}
