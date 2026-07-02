"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function DropTrap() {
  const router = useRouter();

  useEffect(() => {
    window.history.pushState({ dropTrap: true }, "", "/drop");

    const onPopState = () => {
      window.history.pushState({ dropTrap: true }, "", "/drop");
      router.replace("/drop");
    };

    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [router]);

  return null;
}