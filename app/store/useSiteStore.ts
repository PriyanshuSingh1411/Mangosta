"use client";

import { create } from "zustand";

interface SiteState {
  isLoaded: boolean;
  hasEnteredSite: boolean;
  prefersReducedMotion: boolean;
  cursorVariant: "default" | "view" | "explore" | "shop" | "drag" | "hidden";
  cursorLabel: string;
  setLoaded: () => void;
  setEnteredSite: () => void;
  setPrefersReducedMotion: (val: boolean) => void;
  setCursor: (variant: SiteState["cursorVariant"], label?: string) => void;
}

export const useSiteStore = create<SiteState>((set) => ({
  isLoaded: false,
  hasEnteredSite: false,
  prefersReducedMotion: false,
  cursorVariant: "default",
  cursorLabel: "",
  setLoaded: () => set({ isLoaded: true }),
  setEnteredSite: () => set({ hasEnteredSite: true }),
  setPrefersReducedMotion: (val) => set({ prefersReducedMotion: val }),
  setCursor: (variant, label = "") => set({ cursorVariant: variant, cursorLabel: label }),
}));
