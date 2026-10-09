"use client";

import { useSyncExternalStore } from "react";

// Light / dark mode, chosen with the header switch and remembered in this
// browser (localStorage "mangosta-theme"). Every component reading it
// updates together when it changes (and across tabs), and the server
// render always uses dark, the default.

const STORAGE_KEY = "mangosta-theme";
const CHANGE_EVENT = "mangosta-theme-change";

function readIsDark(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) !== "light";
  } catch {
    return true;
  }
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener("storage", onChange);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

/** True in dark mode (the default). */
export function useIsDarkMode(): boolean {
  return useSyncExternalStore(subscribe, readIsDark, () => true);
}

/** Switches the theme, remembers it, and updates the page right away. */
export function setDarkMode(dark: boolean): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, dark ? "dark" : "light");
  } catch {
    // Storage blocked: the switch still applies to this page.
  }
  document.documentElement.classList.toggle("light-theme", !dark);
  window.dispatchEvent(new Event(CHANGE_EVENT));
}
