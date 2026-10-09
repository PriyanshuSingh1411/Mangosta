"use client";

import { useSyncExternalStore } from "react";

// Small helpers for values that only exist in the browser (window,
// localStorage, the visitor's clock). useSyncExternalStore renders the
// server value first and switches to the browser value right after
// hydration, so server and browser HTML always match.

/** For browser values that never change while the page is open. */
export function noBrowserSubscription(): () => void {
  return () => {};
}

/** False while rendering on the server and during hydration, true after. */
export function useIsClient(): boolean {
  return useSyncExternalStore(
    noBrowserSubscription,
    () => true,
    () => false
  );
}

/** For localStorage values: also updates when another tab changes them. */
export function subscribeToStorage(onChange: () => void): () => void {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}

/**
 * A localStorage text value (the server render and hydration use
 * `serverValue`). Returns the raw text, so parse it with useMemo.
 */
export function useStoredText(key: string, serverValue: string): string {
  return useSyncExternalStore(
    subscribeToStorage,
    () => {
      try {
        return window.localStorage.getItem(key) ?? serverValue;
      } catch {
        return serverValue;
      }
    },
    () => serverValue
  );
}
