"use client";

import { useSiteStore } from "@/app/store/useSiteStore";

type CursorVariant = "default" | "view" | "explore" | "shop" | "drag" | "hidden";

/**
 * Returns onMouseEnter/onMouseLeave handlers that switch the global custom
 * cursor into the given variant + label, and revert to default on leave.
 */
export function useCursorHover(variant: CursorVariant, label: string = "") {
  const setCursor = useSiteStore((s) => s.setCursor);

  return {
    onMouseEnter: () => setCursor(variant, label),
    onMouseLeave: () => setCursor("default"),
  };
}
