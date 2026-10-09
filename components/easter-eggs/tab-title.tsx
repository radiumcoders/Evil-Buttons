"use client";

import { useEffect } from "react";
import { findEgg } from "./eggs";

const AWAY = "👁 Come back…";
const BACK = "😈 Knew you would.";

/** Leave the tab and it begs; come back and it gloats, then quietly restores its title. */
export function TabTitle() {
  useEffect(() => {
    let saved: string | null = null;
    let restore: number | null = null;

    const onVisibilityChange = () => {
      if (document.hidden) {
        if (restore !== null) window.clearTimeout(restore);
        saved ??= document.title;
        document.title = AWAY;
        return;
      }
      if (saved === null) return;
      const original = saved;
      saved = null;
      // Navigation while away already replaced the title; leave that one alone.
      if (document.title !== AWAY) return;
      document.title = BACK;
      restore = window.setTimeout(() => {
        restore = null;
        if (document.title === BACK) document.title = original;
      }, 2200);
      findEgg("tab", { title: "Your tab missed you.", note: "Check the title.", onlyFirst: true });
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      if (restore !== null) window.clearTimeout(restore);
    };
  }, []);
  return null;
}
