"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import type { Product } from "@/app/data/productTypes";
import {
  formatPrice,
  getProductSalePrice,
  hasProductDiscount,
} from "@/app/data/productTypes";
import { useCartStore } from "@/app/store/useCartStore";
import { useAuth } from "@/app/components/AuthProvider";
import ProductPlaceholderArt from "./ProductPlaceholderArt";

export default function ProductCard({
  product,
  index = 0,
}: {
  product: Product;
  index?: number;
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const [isPickerOpen, setIsPickerOpen] = useState(false);

  const [selectedColor, setSelectedColor] = useState(
    product.colors[0] ?? null
  );
  const [selectedSize, setSelectedSize] = useState<string | null>(null);

  const [sizeError, setSizeError] = useState(false);

  const addToBag = useCartStore((s) => s.addToBag);
  const openBag = useCartStore((s) => s.openBag);

  const { user, loading: authLoading, openAuth } = useAuth();

  const primaryImage = product.images[0];
  const salePrice = getProductSalePrice(product);
  const hasDiscount = hasProductDiscount(product);
  const discountPercent = Number(product.discountPercent) || 0;

  const openPicker = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();

    setSelectedColor(product.colors[0] ?? null);
    setSelectedSize(null);
    setSizeError(false);
    setIsPickerOpen(true);
  };

  const closePicker = () => {
    setIsPickerOpen(false);
    setSizeError(false);
  };

  const addProductToBag = () => {
    if (!selectedColor || !selectedSize) return;

    addToBag(
      product,
      selectedSize,
      selectedColor.name,
      1
    );

    setIsPickerOpen(false);
    setSelectedSize(null);
    openBag();
  };

  const handleAddToBag = () => {
    if (!selectedColor) return;

    if (!selectedSize) {
      setSizeError(true);
      return;
    }

    setSizeError(false);

    if (authLoading) return;

    if (!user) {
      openAuth("signin", addProductToBag);
      return;
    }

    addProductToBag();
  };

  return (
    <>
      <article className="group relative block">
        {/* ============================================================
            PRODUCT IMAGE
        ============================================================ */}

        <Link
          href={`/product/${product.slug}`}
          aria-label={`View ${product.name}, ${formatPrice(salePrice)}`}
          className="block"
        >
          <div className="relative aspect-[3/4] overflow-hidden bg-charcoal">
            {/* NEW */}
            {product.isNew && (
              <span className="absolute left-4 top-4 z-20 label-technical !text-mango">
                NEW
              </span>
            )}

            {/* INDEX */}
            <span className="absolute right-4 top-4 z-20 label-technical text-bone/70">
              {String(index + 1).padStart(2, "0")}
            </span>

            {/* IMAGE */}
            <div className="absolute inset-0 flex items-center justify-center">
              {primaryImage && !imageFailed ? (
                <Image
                  src={primaryImage}
                  alt={product.name}
                  fill
                  sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                  className="object-contain object-center transition-transform duration-500 group-hover:scale-[1.015]"
                  onError={() => setImageFailed(true)}
                />
              ) : (
                <ProductPlaceholderArt
                  seed={product.id}
                  className="h-full w-full"
                />
              )}
            </div>

            {/* HOVER GRADIENT */}
            <div
              className="
                pointer-events-none
                absolute inset-x-0 bottom-0
                h-32
                opacity-0
                transition-opacity duration-300
                group-hover:opacity-100
              "
              style={{
                background:
                  "linear-gradient(to top, rgba(10,10,10,0.8), transparent)",
              }}
            />

            {/* COLORS */}
            {product.colors.length > 0 && (
              <div
                className="
                  absolute
                  bottom-4
                  left-4
                  flex
                  gap-1.5
                  opacity-0
                  transition-opacity
                  duration-300
                  group-hover:opacity-100
                "
              >
                {product.colors.map((color) => (
                  <span
                    key={color.name}
                    className="h-3 w-3 rounded-full border border-white/40"
                    style={{
                      backgroundColor: color.hex,
                    }}
                    title={color.name}
                  />
                ))}
              </div>
            )}
          </div>
        </Link>

        {/* ============================================================
            PRODUCT INFO
        ============================================================ */}

        <div className="mt-4 flex items-start justify-between gap-3">
          <Link
            href={`/product/${product.slug}`}
            className="min-w-0"
          >
            <h3 className="text-sm font-medium tracking-wide text-bone transition-colors group-hover:text-bone/90">
              {product.name}
            </h3>

            <p className="mt-1 text-xs text-stone">
              {getCategoryLabel(product.category)}
            </p>
          </Link>

          <div className="flex shrink-0 items-start gap-3">
            <div className="flex flex-col items-end">
              <div className="flex items-center gap-2">
                {hasDiscount && (
                  <span className="font-mono text-xs text-stone-dark line-through">
                    {formatPrice(product.price)}
                  </span>
                )}
                <span className="font-mono text-sm text-bone-dim">
                  {formatPrice(salePrice)}
                </span>
              </div>
              {hasDiscount && (
                <span className="mt-1 text-[10px] font-medium tracking-wider text-mango">
                  {discountPercent}% OFF
                </span>
              )}
            </div>

            {/* ========================================================
                + BUTTON
            ======================================================== */}

            <button
              type="button"
              onClick={openPicker}
              aria-label={`Add ${product.name} to bag`}
              className="
                flex
                h-7
                w-7
                items-center
                justify-center
                border
                border-line-strong
                text-bone
                transition-all
                duration-200
                hover:border-bone
                hover:bg-bone
                hover:text-void
              "
            >
              <span className="text-lg font-light leading-none">
                +
              </span>
            </button>
          </div>
        </div>
      </article>

      {/* ================================================================
          COLOR + SIZE PICKER
      ================================================================= */}

      {isPickerOpen && (
        <div
          className="fixed inset-0 z-[10000] flex items-end justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-5"
          onClick={closePicker}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`Select options for ${product.name}`}
            className="
              w-full
              max-w-[480px]
              border
              border-line-strong
              bg-charcoal
              p-6
              text-bone
              sm:p-8
            "
            onClick={(event) => event.stopPropagation()}
          >
            {/* HEADER */}

            <div className="mb-7 flex items-start justify-between">
              <div>
                <p className="label-technical mb-2 text-stone">
                  ADD TO BAG
                </p>

                <h2 className="font-display text-2xl uppercase tracking-tight">
                  {product.name}
                </h2>

                <div className="mt-2 flex items-center gap-2">
                  {hasDiscount && (
                    <span className="font-mono text-xs text-stone-dark line-through">
                      {formatPrice(product.price)}
                    </span>
                  )}
                  <span className="font-mono text-sm text-bone-dim">
                    {formatPrice(salePrice)}
                  </span>
                  {hasDiscount && (
                    <span className="text-[10px] tracking-wider text-mango">
                      {discountPercent}% OFF
                    </span>
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={closePicker}
                aria-label="Close"
                className="
                  flex
                  h-8
                  w-8
                  items-center
                  justify-center
                  border
                  border-line-strong
                  text-lg
                  text-bone-dim
                  transition-colors
                  hover:border-bone
                  hover:text-bone
                "
              >
                ×
              </button>
            </div>

            {/* ========================================================
                COLOR
            ======================================================== */}

            {product.colors.length > 0 && (
              <div className="mb-7">
                <div className="mb-3 flex items-center justify-between">
                  <p className="label-technical">
                    COLOR
                  </p>

                  {selectedColor && (
                    <p className="text-xs uppercase tracking-wider text-stone">
                      {selectedColor.name}
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap gap-3">
                  {product.colors.map((color) => {
                    const active =
                      selectedColor?.name === color.name;

                    return (
                      <button
                        key={color.name}
                        type="button"
                        onClick={() => {
                          setSelectedColor(color);
                          setSizeError(false);
                        }}
                        aria-label={`Select ${color.name}`}
                        aria-pressed={active}
                        className={`
                          flex
                          h-10
                          w-10
                          items-center
                          justify-center
                          rounded-full
                          border
                          transition-all
                          ${
                            active
                              ? "border-mango scale-110"
                              : "border-line-strong hover:border-bone"
                          }
                        `}
                      >
                        <span
                          className="h-7 w-7 rounded-full border border-black/20"
                          style={{
                            backgroundColor: color.hex,
                          }}
                        />
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ========================================================
                SIZE
            ======================================================== */}

            <div className="mb-7">
              <div className="mb-3 flex items-center justify-between">
                <p className="label-technical">
                  SIZE
                </p>

                {sizeError && (
                  <p className="text-xs uppercase tracking-wider text-mango">
                    Select a size
                  </p>
                )}
              </div>

              <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
                {product.sizes.map((size) => {
                  const active = selectedSize === size;

                  return (
                    <button
                      key={size}
                      type="button"
                      onClick={() => {
                        setSelectedSize(size);
                        setSizeError(false);
                      }}
                      aria-pressed={active}
                      className={`
                        h-11
                        border
                        text-xs
                        font-medium
                        tracking-wider
                        transition-colors
                        ${
                          active
                            ? "border-bone bg-bone text-void"
                            : "border-line-strong text-bone hover:border-bone"
                        }
                      `}
                    >
                      {size}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ========================================================
                ADD TO BAG
            ======================================================== */}

            <button
              type="button"
              onClick={handleAddToBag}
              disabled={authLoading}
              className="
                flex
                h-12
                w-full
                items-center
                justify-center
                bg-bone
                text-xs
                font-medium
                uppercase
                tracking-[0.18em]
                text-void
                transition-opacity
                hover:opacity-90
                disabled:cursor-not-allowed
                disabled:opacity-50
              "
            >
              {authLoading ? "PLEASE WAIT..." : "ADD TO BAG"}
            </button>
          </div>
        </div>
      )}
    </>
  );
}

function getCategoryLabel(category: string): string {
  const labels: Record<string, string> = {
    "t-shirts": "T-Shirts",
    hoodies: "Hoodies",
    pants: "Pants",
    jackets: "Jackets",
    accessories: "Accessories",
  };

  return labels[category] ?? category;
}