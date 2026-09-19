"use client";

import { useEffect } from "react";
import { getTracwell } from "@/lib/tracwell";

export function TracwellAnalytics() {
  useEffect(() => {
    getTracwell();
  }, []);

  return null;
}
