"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import type {
  Product,
  ProductColor,
} from "@/app/data/productTypes";
import {
  formatPrice,
  getProductSalePrice,
  hasProductDiscount,
} from "@/app/data/productTypes";
import { useCartStore } from "@/app/store/useCartStore";

export default function ProductQuickAddModal({
  product,
  onClose,
}: {
  product: Product | null;
  onClose: () => void;
}) {
  const [selectedColor, setSelectedColor] =
    useState<ProductColor | null>(null);

  const [selectedSize, setSelectedSize] =
    useState<string | null>(null);

  const [sizeError, setSizeError] =
    useState(false);

  const addToBag = useCartStore(
    (state) => state.addToBag
  );

  const openBag = useCartStore(
    (state) => state.openBag
  );

  useEffect(() => {
    if (!product) return;

    setSelectedColor(
      product.colors[0] ?? null
    );

    setSelectedSize(null);
    setSizeError(false);
  }, [product]);

  useEffect(() => {
    if (!product) return;

    const onKeyDown = (
      event: KeyboardEvent
    ) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.body.style.overflow = "hidden";

    window.addEventListener(
      "keydown",
      onKeyDown
    );

    return () => {
      document.body.style.overflow = "";

      window.removeEventListener(
        "keydown",
        onKeyDown
      );
    };
  }, [product, onClose]);

  if (!product) return null;

  /*
   * PRODUCT DISCOUNT
   *
   * Example:
   *
   * Original price: ₹68
   * Discount:       10%
   * Sale price:     ₹61.20
   */
  const salePrice =
    getProductSalePrice(product);

  const hasDiscount =
    hasProductDiscount(product);

  const discountPercent =
    Number(product.discountPercent) || 0;

  const handleAdd = () => {
    if (!selectedColor) return;

    if (!selectedSize) {
      setSizeError(true);
      return;
    }

    addToBag(
      product,
      selectedSize,
      selectedColor.name
    );

    onClose();
    openBag();
  };

  return (
    <div
      className="fixed inset-0 z-[10020] flex items-end justify-center bg-void/75 p-0 backdrop-blur-sm sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={`Add ${product.name} to bag`}
      onMouseDown={(event) => {
        if (
          event.target ===
          event.currentTarget
        ) {
          onClose();
        }
      }}
    >
      <div className="w-full max-w-xl border border-line-strong bg-charcoal p-5 shadow-2xl sm:p-7">
        {/* =========================================================
            HEADER
        ========================================================= */}
        <div className="mb-6 flex items-start justify-between gap-5">
          <div className="flex min-w-0 items-center gap-4">
            {/* PRODUCT IMAGE */}
            <div className="relative h-20 w-16 shrink-0 overflow-hidden bg-void">
              {product.images[0] ? (
                <Image
                  src={product.images[0]}
                  alt={product.name}
                  fill
                  sizes="64px"
                  className="object-contain p-2"
                />
              ) : null}
            </div>

            {/* PRODUCT DETAILS */}
            <div className="min-w-0">
              <p className="label-technical mb-2">
                QUICK ADD
              </p>

              <h2 className="truncate font-display text-xl uppercase tracking-tight text-bone sm:text-2xl">
                {product.name}
              </h2>

              {/* =====================================================
                  PRICE
              ===================================================== */}
              {hasDiscount ? (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {/* ORIGINAL PRICE */}
                  <span className="font-mono text-xs text-stone-dark line-through">
                    {formatPrice(
                      product.price
                    )}
                  </span>

                  {/* SALE PRICE */}
                  <span className="font-mono text-sm text-bone-dim">
                    {formatPrice(
                      salePrice
                    )}
                  </span>

                  {/* DISCOUNT */}
                  <span className="text-[10px] font-medium tracking-[0.12em] text-mango">
                    {discountPercent}% OFF
                  </span>
                </div>
              ) : (
                <p className="mt-2 font-mono text-sm text-bone-dim">
                  {formatPrice(
                    product.price
                  )}
                </p>
              )}
            </div>
          </div>

          {/* CLOSE BUTTON */}
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 shrink-0 items-center justify-center border border-line-strong text-xl text-stone transition-colors hover:border-bone hover:text-bone"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* =========================================================
            COLOR
        ========================================================= */}
        <div className="border-t border-line pt-5">
          <p className="label-technical mb-3">
            COLOR —{" "}
            <span className="text-bone-dim">
              {selectedColor?.name ??
                "SELECT"}
            </span>
          </p>

          <div className="flex flex-wrap gap-3">
            {product.colors.map(
              (color) => (
                <button
                  key={color.name}
                  type="button"
                  onClick={() =>
                    setSelectedColor(
                      color
                    )
                  }
                  aria-label={color.name}
                  aria-pressed={
                    selectedColor?.name ===
                    color.name
                  }
                  className={`h-9 w-9 rounded-full border-2 transition-transform ${
                    selectedColor?.name ===
                    color.name
                      ? "scale-110 border-mango"
                      : "border-line-strong hover:border-bone-dim"
                  }`}
                  style={{
                    backgroundColor:
                      color.hex,
                  }}
                />
              )
            )}
          </div>
        </div>

        {/* =========================================================
            SIZE
        ========================================================= */}
        <div className="mt-6">
          <p className="label-technical mb-3">
            SIZE{" "}
            {sizeError && (
              <span className="text-mango">
                — PLEASE SELECT A SIZE
              </span>
            )}
          </p>

          <div className="flex flex-wrap gap-2">
            {product.sizes.map(
              (size) => (
                <button
                  key={size}
                  type="button"
                  onClick={() => {
                    setSelectedSize(
                      size
                    );
                    setSizeError(false);
                  }}
                  aria-pressed={
                    selectedSize === size
                  }
                  className={`min-w-14 border px-3 py-2.5 text-xs font-medium tracking-wide transition-colors ${
                    selectedSize === size
                      ? "border-bone bg-bone text-void"
                      : "border-line-strong text-bone-dim hover:border-bone hover:text-bone"
                  }`}
                >
                  {size}
                </button>
              )
            )}
          </div>
        </div>

        {/* =========================================================
            ADD TO BAG
        ========================================================= */}
        <button
          type="button"
          onClick={handleAdd}
          className="mt-7 w-full bg-bone py-4 text-xs font-medium uppercase tracking-[0.18em] text-void transition-colors hover:bg-mango"
        >
          ADD TO BAG
        </button>
      </div>
    </div>
  );
}