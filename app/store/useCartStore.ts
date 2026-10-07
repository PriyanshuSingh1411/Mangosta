"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import {
  getProductSalePrice,
  getVariantStock,
  hasVariantStock,
} from "@/app/data/productTypes";
import type { Product } from "@/app/data/productTypes";
import { trackEngagement } from "@/app/lib/trackEngagement";

/**
 * Units of this size/colour the customer can still have in the bag.
 * Products with stock per size & colour are limited per variant; other
 * products share one stock across all of their lines.
 */
export function maxAllowedForLine(
  lines: CartLine[],
  product: Product,
  size: string,
  color: string,
  lineId: string
): number {
  const stock = getVariantStock(product, color, size);
  if (hasVariantStock(product)) return stock;

  const inOtherLines = lines
    .filter((line) => line.product.id === product.id && line.lineId !== lineId)
    .reduce((sum, line) => sum + line.quantity, 0);

  return Math.max(0, stock - inOtherLines);
}

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
  /** Empties the bag after an order is placed — not a customer "remove". */
  clearCartAfterOrder: () => void;
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
  // Validate stock (per size & colour when the product tracks it)
  const requestedQuantity = Math.max(1, quantity);
  const lineId = `${product.id}-${size}-${color}`;

  const currentInventory = maxAllowedForLine(
    get().lines,
    product,
    size,
    color,
    lineId
  );

  // Check if there's enough inventory
  if (requestedQuantity > currentInventory) {
    console.warn(
      `Cannot add ${product.name}: only ${currentInventory} in stock, requested ${requestedQuantity}`
    );
    return;
  }

  const existing = get().lines.find((line) => line.lineId === lineId);

  if (existing) {
    const newQuantity = existing.quantity + requestedQuantity;

    // Validate total quantity doesn't exceed inventory
    if (newQuantity > currentInventory) {
      console.warn(
        `Cannot add ${product.name}: total quantity ${newQuantity} exceeds inventory ${currentInventory}`
      );
      return;
    }
  }

  set((state) => {
    const existingLine = state.lines.find(
      (line) => line.lineId === lineId
    );

    if (existingLine) {
      const newQuantity =
        existingLine.quantity + requestedQuantity;

      return {
        lines: state.lines.map((line) =>
          line.lineId === lineId
            ? { ...line, quantity: newQuantity }
            : line
        ),
        lastAddedLineId: lineId,
      };
    }

    return {
      lines: [
        ...state.lines,
        {
          lineId,
          product,
          size,
          color,
          quantity: requestedQuantity,
        },
      ],
      lastAddedLineId: lineId,
    };
  });

  // Track only after the stock validation and cart update succeed.
  void trackEngagement({
    event: "cart_add",
    productId: product.id,
    metadata: {
      productName: product.name,
      category: product.category,
      size,
      color,
      quantity: requestedQuantity,
      price: getProductSalePrice(product),
    },
  });
},

     removeLine: (lineId) => {
  const line = get().lines.find(
    (item) => item.lineId === lineId
  );

  if (!line) return;

  set((state) => ({
    lines: state.lines.filter(
      (item) => item.lineId !== lineId
    ),
  }));

  void trackEngagement({
    event: "cart_remove",
    productId: line.product.id,
    metadata: {
      productName: line.product.name,
      category: line.product.category,
      size: line.size,
      color: line.color,
      quantity: line.quantity,
      price: getProductSalePrice(line.product),
    },
  });
},
updateQuantity: (lineId, quantity) => {
  const currentLine = get().lines.find(
    (line) => line.lineId === lineId
  );

  if (!currentLine) {
    return;
  }

  if (quantity <= 0) {
    set((state) => ({
      lines: state.lines.filter(
        (line) => line.lineId !== lineId
      ),
    }));

    void trackEngagement({
      event: "cart_remove",
      productId: currentLine.product.id,
      metadata: {
        productName: currentLine.product.name,
        category: currentLine.product.category,
        size: currentLine.size,
        color: currentLine.color,
        quantity: currentLine.quantity,
        previousQuantity: currentLine.quantity,
        newQuantity: 0,
        price: getProductSalePrice(currentLine.product),
        reason: "quantity_decreased_to_zero",
      },
    });

    return;
  }

  const currentInventory = maxAllowedForLine(
    get().lines,
    currentLine.product,
    currentLine.size,
    currentLine.color,
    currentLine.lineId
  );

  if (quantity > currentInventory) {
    console.warn(
      `Cannot update ${currentLine.product.name}: requested quantity ${quantity} exceeds inventory ${currentInventory}`
    );
    return;
  }

  if (quantity === currentLine.quantity) {
    return;
  }

  set((state) => ({
    lines: state.lines.map((line) =>
      line.lineId === lineId
        ? { ...line, quantity }
        : line
    ),
  }));

  void trackEngagement({
    event: quantity > currentLine.quantity
      ? "cart_add"
      : "cart_remove",
    productId: currentLine.product.id,
    metadata: {
      productName: currentLine.product.name,
      category: currentLine.product.category,
      size: currentLine.size,
      color: currentLine.color,
      quantity: Math.abs(quantity - currentLine.quantity),
      previousQuantity: currentLine.quantity,
      newQuantity: quantity,
      price: getProductSalePrice(currentLine.product),
      reason:
        quantity > currentLine.quantity
          ? "quantity_increased"
          : "quantity_decreased",
    },
  });
},

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

     clearCartAfterOrder: () => {
  // The items were bought, not removed: no cart_remove events.
  set({ lines: [] });
},

     clearCart: () => {
  const currentLines = get().lines;

  if (currentLines.length === 0) return;

  set({ lines: [] });

  for (const line of currentLines) {
    void trackEngagement({
      event: "cart_remove",
      productId: line.product.id,
      metadata: {
        productName: line.product.name,
        category: line.product.category,
        size: line.size,
        color: line.color,
        quantity: line.quantity,
        price: getProductSalePrice(line.product),
        reason: "clear_bag",
      },
    });
  }
},
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