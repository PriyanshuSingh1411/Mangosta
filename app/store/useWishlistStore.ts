"use client";

import { create } from "zustand";

// Signed-in customer's wishlist (saved on their account via /api/wishlist).

interface WishlistState {
  productIds: string[];
  /** User id the list was loaded for ("" = not loaded). */
  loadedFor: string;
  loading: Promise<void> | null;
  load: (userId: string) => Promise<void>;
  reset: () => void;
  setSaved: (productId: string, saved: boolean) => Promise<boolean>;
}

export const useWishlistStore = create<WishlistState>()((set, get) => ({
  productIds: [],
  loadedFor: "",
  loading: null,

  load: async (userId) => {
    if (get().loadedFor === userId) return;
    const inFlight = get().loading;
    if (inFlight) return inFlight;

    const request = (async () => {
      try {
        const response = await fetch("/api/wishlist", { cache: "no-store" });
        const data = await response.json().catch(() => null);
        set({
          productIds: response.ok && Array.isArray(data?.productIds) ? data.productIds : [],
          loadedFor: userId,
        });
      } finally {
        set({ loading: null });
      }
    })();

    set({ loading: request });
    return request;
  },

  reset: () => set({ productIds: [], loadedFor: "", loading: null }),

  /** Optimistic save/remove; rolls back if the server refuses. */
  setSaved: async (productId, saved) => {
    const previous = get().productIds;
    set({
      productIds: saved
        ? [productId, ...previous.filter((id) => id !== productId)]
        : previous.filter((id) => id !== productId),
    });

    try {
      const response = await fetch("/api/wishlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, saved }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || "Failed");
      if (Array.isArray(data?.productIds)) set({ productIds: data.productIds });
      return true;
    } catch {
      set({ productIds: previous });
      return false;
    }
  },
}));
