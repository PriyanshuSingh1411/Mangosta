"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { Product } from "@/app/data/productTypes";

export interface CartLine {
  lineId: string;
  product: Product;
  size: string;
  color: string;
  quantity: number;
}

interface CartState {
  lines: CartLine[];
  isBagOpen: boolean;
  isSearchOpen: boolean;
  isMenuOpen: boolean;
  lastAddedLineId: string | null;
  addToBag: (product: Product, size: string, color: string, quantity?: number) => void;
  removeLine: (lineId: string) => void;
  updateQuantity: (lineId: string, quantity: number) => void;
  openBag: () => void;
  closeBag: () => void;
  openSearch: () => void;
  closeSearch: () => void;
  openMenu: () => void;
  closeMenu: () => void;
  subtotal: () => number;
  itemCount: () => number;
  clearCart: () => void;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      lines: [],
      isBagOpen: false,
      isSearchOpen: false,
      isMenuOpen: false,
      lastAddedLineId: null,

      addToBag: (product, size, color, quantity = 1) => {
        const lineId = `${product.id}-${size}-${color}`;
        set((state) => {
          const existing = state.lines.find((l) => l.lineId === lineId);
          if (existing) {
            return {
              lines: state.lines.map((l) =>
                l.lineId === lineId ? { ...l, quantity: l.quantity + quantity } : l
              ),
              lastAddedLineId: lineId,
            };
          }
          return {
            lines: [...state.lines, { lineId, product, size, color, quantity }],
            lastAddedLineId: lineId,
          };
        });
      },

      removeLine: (lineId) =>
        set((state) => ({ lines: state.lines.filter((l) => l.lineId !== lineId) })),

      updateQuantity: (lineId, quantity) =>
        set((state) => ({
          lines:
            quantity <= 0
              ? state.lines.filter((l) => l.lineId !== lineId)
              : state.lines.map((l) => (l.lineId === lineId ? { ...l, quantity } : l)),
        })),

      openBag: () => set({ isBagOpen: true, isSearchOpen: false, isMenuOpen: false }),
      closeBag: () => set({ isBagOpen: false }),
      openSearch: () => set({ isSearchOpen: true, isBagOpen: false, isMenuOpen: false }),
      closeSearch: () => set({ isSearchOpen: false }),
      openMenu: () => set({ isMenuOpen: true, isBagOpen: false, isSearchOpen: false }),
      closeMenu: () => set({ isMenuOpen: false }),

      subtotal: () => {
        return get().lines.reduce((sum, l) => sum + l.product.price * l.quantity, 0);
      },

      itemCount: () => {
        return get().lines.reduce((sum, l) => sum + l.quantity, 0);
      },

      clearCart: () => set({ lines: [] }),
    }),
    {
      name: "mangosta-cart",
      storage: createJSONStorage(() => localStorage),
      // Only persist the cart contents - drawer/search/menu open-state should
      // always start closed on a fresh page load, not be restored.
      partialize: (state) => ({ lines: state.lines }),
    }
  )
);
