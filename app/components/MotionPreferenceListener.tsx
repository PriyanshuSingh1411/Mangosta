"use client";

import { useEffect } from "react";
import { useSiteStore } from "@/app/store/useSiteStore";

export default function MotionPreferenceListener() {
  const setPrefersReducedMotion = useSiteStore((s) => s.setPrefersReducedMotion);

  useEffect(() => {
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mql.matches);
    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, [setPrefersReducedMotion]);

  return null;
}
