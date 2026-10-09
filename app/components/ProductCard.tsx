"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import type { Product } from "@/app/data/productTypes";
import {
  formatPrice,
  getProductSalePrice,
  getProductSizes,
  getVariantStock,
  hasProductDiscount,
  getProductStrikethroughPrice,
  getProductSavingsPercent,
} from "@/app/data/productTypes";
import type { ReviewSummary } from "@/app/data/storeTypes";
import { bagLimitMessage, maxAllowedForLine, useCartStore } from "@/app/store/useCartStore";
import { useAuth } from "@/app/components/AuthProvider";
import ProductPlaceholderArt from "./ProductPlaceholderArt";
import WishlistButton from "./WishlistButton";
import ProductQuickAddModal from "./ProductQuickAddModal";

/** Colour swatches shown on a card before switching to "+N". */
const MAX_CARD_SWATCHES = 3;

const RECENT_KEY = "mangosta-recently-viewed";

/**
 * One product card for the whole site (home sections, shop, product page,
 * wishlist, account). Layout:
 *
 *   [ image ............ ♡ ]
 *   Product name (one line)
 *   ₹3,299.00  ₹2,609.10  SAVE 21%        +   (% vs the crossed-out price)
 *   ■ ■ ■ +2                        ★ 4.5 (12)
 */
export default function ProductCard({
  product,
  rating,
  href,
  title,
  titleClassName = "",
}: {
  product: Product;
  rating?: ReviewSummary;
  /** Optional link override (THE DROP lets admins set a custom link). */
  href?: string;
  /** Optional name override (THE DROP lets admins set a custom title). */
  title?: string;
  /** Optional extra classes for the name (THE DROP title font). */
  titleClassName?: string;
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [isQuickViewOpen, setIsQuickViewOpen] = useState(false);

  const [selectedColor, setSelectedColor] = useState(
    product.colors[0] ?? null
  );
  const [selectedSize, setSelectedSize] = useState<string | null>(null);

  const [sizeError, setSizeError] = useState(false);
  const [stockError, setStockError] = useState<string | null>(null);

  const sizes = getProductSizes(product);
  const soldOut = (Number(product.inventory) || 0) <= 0;
  const colorName = selectedColor?.name ?? "";

  const addToBag = useCartStore((s) => s.addToBag);
  const openBag = useCartStore((s) => s.openBag);

  const { user, loading: authLoading, openAuth } = useAuth();

  const primaryImage = product.images[0];
  const salePrice = getProductSalePrice(product);
  const strikethroughPrice = getProductStrikethroughPrice(product);
  const hasDiscount = hasProductDiscount(product);
  // "SAVE x%" against the crossed-out price shown next to it.
  const discountPercent = getProductSavingsPercent(product) ?? 0;
  const showStrikethrough =
    strikethroughPrice !== null && strikethroughPrice > salePrice;
  const showSave = hasDiscount && discountPercent > 0;

  const productHref = href?.trim() || `/product/${product.slug}`;
  const displayName = title?.trim() || product.name;

  const swatches = product.colors.slice(0, MAX_CARD_SWATCHES);
  const extraColors = Math.max(0, product.colors.length - MAX_CARD_SWATCHES);
  const hasRating = Boolean(rating && rating.count > 0);

  const rememberView = () => {
    try {
      const current = JSON.parse(
        window.localStorage.getItem(RECENT_KEY) || "[]"
      ) as string[];
      const next = [
        product.id,
        ...current.filter((id) => id !== product.id),
      ].slice(0, 8);
      window.localStorage.setItem(RECENT_KEY, JSON.stringify(next));
    } catch {}
  };

  const openPicker = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();

    setSelectedColor(product.colors[0] ?? null);
    setSelectedSize(sizes.length === 1 ? sizes[0] : null);
    setSizeError(false);
    setStockError(null);
    setIsPickerOpen(true);
  };

  const closePicker = () => {
    setIsPickerOpen(false);
    setSizeError(false);
  };

  const addProductToBag = () => {
    if (!selectedSize) return;

    const state = useCartStore.getState();
    const lineId = `${product.id}-${selectedSize}-${colorName}`;
    const inBag = state.lines.find((line) => line.lineId === lineId)?.quantity ?? 0;
    const allowed = maxAllowedForLine(state.lines, product, selectedSize, colorName, lineId);
    if (inBag + 1 > allowed) {
      setStockError(bagLimitMessage(inBag, allowed));
      return;
    }

    addToBag(
      product,
      selectedSize,
      colorName,
      1
    );

    setIsPickerOpen(false);
    setSelectedSize(null);
    openBag();
  };

  const handleAddToBag = () => {
    if (product.colors.length > 0 && !selectedColor) return;

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
      <article className="group relative min-w-0">
        {/* ============================================================
            PRODUCT IMAGE
        ============================================================ */}

        <div className="relative">
          <Link
            href={productHref}
            aria-label={`View ${displayName}, ${formatPrice(salePrice)}`}
            className="block"
            onClick={rememberView}
          >
            <div className="relative aspect-[4/5] overflow-hidden bg-charcoal">
              {primaryImage && !imageFailed ? (
                <Image
                  src={primaryImage}
                  alt={displayName}
                  fill
                  sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                  className="object-contain object-center transition-transform duration-500 group-hover:scale-[1.02]"
                  loading="lazy"
                  onError={() => setImageFailed(true)}
                />
              ) : (
                <ProductPlaceholderArt
                  seed={product.id}
                  className="h-full w-full"
                />
              )}

              {/* NEW */}
              {product.isNew && (
                <span className="label-technical absolute left-2 top-2.5 z-10 bg-void/80 px-1.5 py-1 !text-[9px] leading-none !text-mango sm:left-2.5">
                  NEW
                </span>
              )}

              {/* SOLD OUT */}
              {soldOut && (
                <span className="absolute bottom-2.5 left-2.5 z-10 bg-void/85 px-2 py-1 font-mono text-[9px] uppercase tracking-[0.16em] text-bone sm:bottom-3 sm:left-3">
                  Sold out
                </span>
              )}
            </div>
          </Link>

          {/* WISHLIST — top right of the image */}
          <WishlistButton
            productId={product.id}
            productName={product.name}
            size="sm"
            className="absolute right-2 top-2 z-20 h-8 w-8 rounded-full bg-void/30 backdrop-blur-sm sm:right-2.5 sm:top-2.5"
          />

          {/* QUICK VIEW — mouse / trackpad screens only, on hover */}
          <button
            type="button"
            onClick={() => setIsQuickViewOpen(true)}
            className="absolute bottom-3 right-3 z-20 hidden border border-bone/50 bg-void/80 px-3 py-2 text-[10px] font-medium tracking-[0.16em] text-bone opacity-0 backdrop-blur-sm transition-all hover:border-bone hover:bg-bone hover:text-void focus-visible:opacity-100 group-hover:opacity-100 [@media(hover:hover)_and_(pointer:fine)]:inline-flex"
            aria-label={`Quick view ${product.name}`}
          >
            QUICK VIEW
          </button>
        </div>

        {/* ============================================================
            PRODUCT INFO
        ============================================================ */}

        <div className="px-2 pt-2 sm:px-2.5 sm:pt-2.5">
          {/* NAME */}
          <Link
            href={productHref}
            className="block min-w-0"
            title={displayName}
            onClick={rememberView}
          >
            <h3
              className={`truncate text-[13px] font-normal leading-[18px] text-bone transition-colors group-hover:text-bone-dim sm:text-sm sm:leading-5 ${titleClassName}`}
            >
              {displayName}
            </h3>
          </Link>

          {/* PRICE + ADD */}
          <div className="mt-1 flex items-start justify-between gap-2">
            <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
              {showStrikethrough && (
                <span className="text-[11px] leading-[18px] tabular-nums text-stone line-through sm:text-xs sm:leading-5">
                  <span className="sr-only">Original price </span>
                  {formatPrice(strikethroughPrice)}
                </span>
              )}

              <span className="text-xs font-bold leading-[18px] tabular-nums text-bone sm:text-[13px] sm:leading-5">
                {showStrikethrough && (
                  <span className="sr-only">Sale price </span>
                )}
                {formatPrice(salePrice)}
              </span>

              {showSave && (
                <span className="rounded-sm bg-mango/10 px-1.5 py-[3px] text-[10px] font-semibold uppercase leading-none tracking-[0.08em] text-mango">
                  Save {discountPercent}%
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={openPicker}
              aria-label={`Add ${product.name} to bag`}
              className="-mr-1.5 -my-[5px] flex h-7 w-7 shrink-0 items-center justify-center text-bone transition-colors hover:text-mango sm:-my-1"
            >
              <svg
                viewBox="0 0 24 24"
                className="h-[15px] w-[15px]"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                aria-hidden="true"
              >
                <path d="M12 4.5v15M4.5 12h15" />
              </svg>
            </button>
          </div>

          {/* COLOURS (max 3 + count) + RATING */}
          {(swatches.length > 0 || hasRating) && (
            <div className="mt-2 flex min-h-[11px] items-center justify-between gap-2">
              {swatches.length > 0 && (
                <div className="flex min-w-0 items-center gap-1">
                  <span className="sr-only">
                    {`Available in ${product.colors.length} colour${
                      product.colors.length === 1 ? "" : "s"
                    }: ${product.colors.map((c) => c.name).join(", ")}`}
                  </span>

                  {swatches.map((color, index) => (
                    <span
                      key={`${color.name}-${index}`}
                      className="h-2 w-2 shrink-0 ring-1 ring-line-strong sm:h-[9px] sm:w-[9px]"
                      style={{ backgroundColor: color.hex }}
                      title={color.name}
                      aria-hidden="true"
                    />
                  ))}

                  {extraColors > 0 && (
                    <span
                      className="ml-1 text-[11px] leading-none tabular-nums text-stone sm:text-xs"
                      aria-hidden="true"
                    >
                      +{extraColors}
                    </span>
                  )}
                </div>
              )}

              {rating && hasRating && (
                <span
                  className="ml-auto flex shrink-0 items-center gap-1 text-[11px] leading-none tabular-nums text-stone"
                  aria-label={`${rating.average.toFixed(1)} out of 5 stars, ${rating.count} review${
                    rating.count === 1 ? "" : "s"
                  }`}
                >
                  <svg
                    viewBox="0 0 24 24"
                    className="h-3 w-3 text-mango"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path d="m12 2.8 2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.2l-5.7 3.1 1.2-6.4-4.7-4.4 6.4-.8L12 2.8Z" />
                  </svg>
                  <span aria-hidden="true">
                    {rating.average.toFixed(1)} ({rating.count})
                  </span>
                </span>
              )}
            </div>
          )}
        </div>
      </article>

      <ProductQuickAddModal product={isQuickViewOpen ? product : null} onClose={() => setIsQuickViewOpen(false)} />

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

                <h2 className="type-heading uppercase">
                  {product.name}
                </h2>

                <div className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1">
                  {showStrikethrough && (
                    <span className="text-xs tabular-nums text-stone line-through">
                      {formatPrice(strikethroughPrice)}
                    </span>
                  )}
                  <span className="text-sm font-bold tabular-nums text-bone">
                    {formatPrice(salePrice)}
                  </span>
                  {showSave && (
                    <span className="rounded-sm bg-mango/10 px-1.5 py-[3px] text-[10px] font-semibold uppercase leading-none tracking-[0.08em] text-mango">
                      Save {discountPercent}%
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
                          setStockError(null);
                          if (selectedSize && getVariantStock(product, color.name, selectedSize) <= 0) {
                            setSelectedSize(null);
                          }
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
                {sizes.map((size) => {
                  const active = selectedSize === size;
                  const sizeSoldOut = getVariantStock(product, colorName, size) <= 0;

                  return (
                    <button
                      key={size}
                      type="button"
                      disabled={sizeSoldOut}
                      onClick={() => {
                        setSelectedSize(size);
                        setSizeError(false);
                        setStockError(null);
                      }}
                      aria-pressed={active}
                      aria-label={sizeSoldOut ? `${size} — sold out` : size}
                      className={`
                        h-11
                        border
                        text-xs
                        font-medium
                        tracking-wider
                        transition-colors
                        disabled:cursor-not-allowed
                        ${
                          sizeSoldOut
                            ? "border-line text-stone-dark line-through"
                            : active
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
              disabled={authLoading || soldOut}
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
              {authLoading ? "PLEASE WAIT..." : soldOut ? "SOLD OUT" : "ADD TO BAG"}
            </button>

            {stockError && (
              <p role="alert" className="mt-3 text-xs text-mango">{stockError}</p>
            )}

            <Link
              href={`/product/${product.slug}`}
              className="mt-4 block text-center text-[10px] uppercase tracking-[0.18em] text-stone underline underline-offset-4 hover:text-bone"
            >
              View details{soldOut ? " · notify me" : ""}
            </Link>
          </div>
        </div>
      )}
    </>
  );
}
