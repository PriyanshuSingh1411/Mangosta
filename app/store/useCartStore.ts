"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { getProductSalePrice } from "@/app/data/productTypes";
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
  searchQuery: string;
  addToBag: (product: Product, size: string, color: string, quantity?: number) => void;
  removeLine: (lineId: string) => void;
  updateQuantity: (lineId: string, quantity: number) => void;
  openBag: () => void;
  closeBag: () => void;
  openSearch: () => void;
  closeSearch: () => void;
  openMenu: () => void;
  closeMenu: () => void;
  setSearchQuery: (query: string) => void;
  clearSearchQuery: () => void;
  subtotal: () => number;
  syncProducts: () => Promise<void>;
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
      searchQuery: "",

      addToBag: (product, size, color, quantity = 1) => {
        // Validate inventory before adding to cart
        const requestedQuantity = Math.max(1, quantity);
        const currentInventory = Math.max(0, product.inventory || 0);

        // Check if there's enough inventory
        if (requestedQuantity > currentInventory) {
          console.warn(
            `Cannot add ${product.name}: only ${currentInventory} in stock, requested ${requestedQuantity}`
          );
          return;
        }

        const lineId = `${product.id}-${size}-${color}`;
        set((state) => {
          const existing = state.lines.find((l) => l.lineId === lineId);

          if (existing) {
            const newQuantity = existing.quantity + requestedQuantity;

            // Validate total quantity doesn't exceed inventory
            if (newQuantity > currentInventory) {
              console.warn(
                `Cannot add ${product.name}: total quantity ${newQuantity} exceeds inventory ${currentInventory}`
              );
              return state;
            }

            return {
              lines: state.lines.map((l) =>
                l.lineId === lineId ? { ...l, quantity: newQuantity } : l
              ),
              lastAddedLineId: lineId,
            };
          }

          return {
            lines: [...state.lines, { lineId, product, size, color, quantity: requestedQuantity }],
            lastAddedLineId: lineId,
          };
        });
      },

      removeLine: (lineId) =>
        set((state) => ({ lines: state.lines.filter((l) => l.lineId !== lineId) })),

      updateQuantity: (lineId, quantity) =>
        set((state) => {
          if (quantity <= 0) {
            return { lines: state.lines.filter((l) => l.lineId !== lineId) };
          }

          // Find the line to validate inventory
          const lineToUpdate = state.lines.find((l) => l.lineId === lineId);
          if (!lineToUpdate) {
            return state;
          }

          // Validate inventory
          const currentInventory = Math.max(0, lineToUpdate.product.inventory || 0);
          if (quantity > currentInventory) {
            console.warn(
              `Cannot update ${lineToUpdate.product.name}: requested quantity ${quantity} exceeds inventory ${currentInventory}`
            );
            return state;
          }

          return {
            lines: state.lines.map((l) =>
              l.lineId === lineId ? { ...l, quantity } : l
            ),
          };
        }),

      openBag: () => set({ isBagOpen: true, isSearchOpen: false, isMenuOpen: false }),
      closeBag: () => set({ isBagOpen: false }),
      openSearch: () => set({ isSearchOpen: true, isBagOpen: false, isMenuOpen: false }),
      closeSearch: () => set({ isSearchOpen: false, searchQuery: "" }),
      openMenu: () => set({ isMenuOpen: true, isBagOpen: false, isSearchOpen: false }),
      closeMenu: () => set({ isMenuOpen: false }),
      setSearchQuery: (query) => set({ searchQuery: query }),
      clearSearchQuery: () => set({ searchQuery: "" }),

      subtotal: () => {
        return get().lines.reduce(
          (sum, l) =>
            sum + getProductSalePrice(l.product) * l.quantity,
          0
        );
      },

      syncProducts: async () => {
        try {
          const response = await fetch("/api/products", {
            cache: "no-store",
          });

          if (!response.ok) return;

          const products: Product[] = await response.json();
          const productsById = new Map(
            products.map((product) => [product.id, product])
          );

          set((state) => ({
            lines: state.lines.map((line) => {
              const freshProduct = productsById.get(line.product.id);
              return freshProduct
                ? { ...line, product: freshProduct }
                : line;
            }),
          }));
        } catch {
          // Keep the persisted cart if the product refresh fails.
        }
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