"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import type { Product, ProductColor } from "@/app/data/productTypes";
import {
  formatPrice,
  getColorImages,
  getProductSalePrice,
  getProductSizes,
  getVariantStock,
  hasProductDiscount,
  getProductStrikethroughPrice,
  getProductSavingsPercent,
  LOW_STOCK_THRESHOLD,
} from "@/app/data/productTypes";
import { bagLimitMessage, maxAllowedForLine, useCartStore } from "@/app/store/useCartStore";
import { useAuth } from "@/app/components/AuthProvider";
import WishlistButton from "@/app/components/WishlistButton";
import ProductPlaceholderArt from "@/app/components/ProductPlaceholderArt";

export default function ProductQuickAddModal({
  product,
  onClose,
}: {
  product: Product | null;
  onClose: () => void;
}) {
  const [selectedColor, setSelectedColor] = useState<ProductColor | null>(null);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [activeImage, setActiveImage] = useState(0);
  const [sizeError, setSizeError] = useState(false);
  const [stockError, setStockError] = useState<string | null>(null);
  const { user, loading: authLoading, openAuth } = useAuth();
  const addToBag = useCartStore((state) => state.addToBag);
  const openBag = useCartStore((state) => state.openBag);

  // A different product was opened: start with its first colour (and its
  // only size, if it has one). Adjusted while rendering, not in an effect,
  // so the previous product's choices never show for a moment.
  const [shownProduct, setShownProduct] = useState<Product | null>(null);
  if (product !== shownProduct) {
    setShownProduct(product);
    if (product) {
      const sizes = getProductSizes(product);
      setSelectedColor(product.colors[0] ?? null);
      setSelectedSize(sizes.length === 1 ? sizes[0] : null);
      setActiveImage(0);
      setSizeError(false);
      setStockError(null);
    }
  }

  useEffect(() => {
    if (!product) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [product, onClose]);

  if (!product) return null;

  const colorName = selectedColor?.name ?? "";
  const images = getColorImages(product, colorName);
  const sizes = getProductSizes(product);
  const salePrice = getProductSalePrice(product);
  const strikethrough = getProductStrikethroughPrice(product);
  const hasDiscount = hasProductDiscount(product);
  const discountPercent = getProductSavingsPercent(product) ?? 0; // vs the crossed-out price
  const productStock = Math.max(0, Number(product.inventory) || 0);
  const selectedStock = selectedSize ? getVariantStock(product, colorName, selectedSize) : 0;
  const soldOut = productStock <= 0;

  const doAdd = () => {
    if (!selectedSize) {
      setSizeError(true);
      return;
    }
    const state = useCartStore.getState();
    const lineId = `${product.id}-${selectedSize}-${colorName}`;
    const inBag = state.lines.find((line) => line.lineId === lineId)?.quantity ?? 0;
    const allowed = maxAllowedForLine(state.lines, product, selectedSize, colorName, lineId);
    if (inBag + 1 > allowed) {
      setStockError(bagLimitMessage(inBag, allowed));
      return;
    }
    addToBag(product, selectedSize, colorName, 1);
    onClose();
    openBag();
  };

  const handleAdd = () => {
    if (authLoading || soldOut) return;
    if (!selectedSize) {
      setSizeError(true);
      return;
    }
    if (!user) {
      openAuth("signin", doAdd);
      return;
    }
    doAdd();
  };

  return (
    <div
      className="fixed inset-0 z-[10020] flex items-end justify-end bg-void/75 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={`Quick view ${product.name}`}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="flex h-[92svh] w-full max-w-3xl flex-col overflow-y-auto border-l border-line-strong bg-charcoal shadow-2xl sm:h-full">
        <div className="sticky top-0 z-20 flex items-center justify-between border-b border-line bg-charcoal/95 px-5 py-4 backdrop-blur sm:px-7">
          <div>
            <p className="label-technical text-mango">QUICK VIEW</p>
            <p className="mt-1 text-xs text-stone">Choose your colour and size without leaving the shop.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close quick view"
            className="flex h-9 w-9 items-center justify-center border border-line-strong text-xl text-stone hover:border-bone hover:text-bone"
          >
            ×
          </button>
        </div>

        <div className="grid gap-7 p-5 sm:grid-cols-[minmax(0,1fr)_minmax(280px,0.85fr)] sm:p-7">
          <div>
            <div className="relative aspect-[3/4] overflow-hidden bg-void">
              {images[activeImage] ? (
                <Image
                  src={images[activeImage]}
                  alt={product.name}
                  fill
                  sizes="(max-width: 640px) 100vw, 45vw"
                  className="object-contain"
                  loading="lazy"
                />
              ) : (
                <ProductPlaceholderArt seed={product.id} className="h-full w-full" />
              )}
              {product.isNew && <span className="absolute left-4 top-4 label-technical text-mango">NEW</span>}
              {soldOut && (
                <span className="absolute bottom-4 left-4 bg-void/80 px-2 py-1 font-mono text-[10px] tracking-[0.16em]">
                  SOLD OUT
                </span>
              )}
            </div>
            {images.length > 1 && (
              <div className="mt-3 flex gap-2 overflow-x-auto">
                {images.map((image, index) => (
                  <button
                    key={`${image}-${index}`}
                    type="button"
                    onClick={() => setActiveImage(index)}
                    className={`relative h-16 w-14 shrink-0 overflow-hidden border ${index === activeImage ? "border-mango" : "border-line-strong"}`}
                  >
                    <Image src={image} alt="" fill sizes="56px" className="object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="min-w-0">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="label-technical mb-2">{product.dropLabel || "MANGOSTA"}</p>
                <h2 className="break-words type-heading uppercase tracking-tight text-bone">
                  {product.name}
                </h2>
              </div>
              <WishlistButton
                productId={product.id}
                productName={product.name}
                className="h-10 w-10 shrink-0 border border-line-strong"
              />
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              {strikethrough && (
                <span className="font-body tabular-nums text-xs text-stone-dark line-through">
                  {formatPrice(strikethrough)}
                </span>
              )}
              <span
                className={`type-price text-base ${hasDiscount ? "font-semibold text-mango" : "text-bone"}`}
              >
                {formatPrice(salePrice)}
              </span>
              {hasDiscount && discountPercent > 0 && (
                <span className="rounded-sm bg-mango/10 px-1.5 py-[3px] text-[10px] font-semibold uppercase leading-none tracking-[0.08em] text-mango">
                  Save {discountPercent}%
                </span>
              )}
            </div>

            <p className="mt-4 text-sm leading-relaxed text-stone">{product.description}</p>

            {product.colors.length > 0 && (
              <div className="mt-7">
                <div className="mb-3 flex justify-between">
                  <p className="label-technical">COLOUR</p>
                  <span className="text-xs text-stone">{selectedColor?.name}</span>
                </div>
                <div className="flex flex-wrap gap-3">
                  {product.colors.map((color) => (
                    <button
                      key={color.name}
                      type="button"
                      onClick={() => {
                        setSelectedColor(color);
                        setActiveImage(0);
                        setStockError(null);
                        if (selectedSize && getVariantStock(product, color.name, selectedSize) <= 0)
                          setSelectedSize(null);
                      }}
                      aria-label={color.name}
                      className={`h-10 w-10 rounded-full border-2 ${selectedColor?.name === color.name ? "border-mango" : "border-line-strong"}`}
                    >
                      <span
                        className="block h-7 w-7 rounded-full border border-black/20"
                        style={{ backgroundColor: color.hex }}
                      />
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-7">
              <div className="mb-3 flex items-center justify-between">
                <p className="label-technical">SIZE</p>
                {sizeError && <span className="text-xs text-mango">SELECT A SIZE</span>}
              </div>
              <div className="grid grid-cols-4 gap-2">
                {sizes.map((size) => {
                  const available = getVariantStock(product, colorName, size);
                  const disabled = available <= 0;
                  return (
                    <button
                      key={size}
                      type="button"
                      disabled={disabled}
                      onClick={() => {
                        setSelectedSize(size);
                        setSizeError(false);
                        setStockError(null);
                      }}
                      className={`border px-3 py-3 text-xs tracking-wider disabled:cursor-not-allowed ${disabled ? "border-line text-stone-dark line-through" : selectedSize === size ? "border-bone bg-bone text-void" : "border-line-strong text-bone hover:border-bone"}`}
                    >
                      {size}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-5 min-h-5">
              {selectedSize && selectedStock > 0 && selectedStock <= LOW_STOCK_THRESHOLD ? (
                <p className="text-xs font-medium text-mango">ONLY {selectedStock} LEFT IN THIS SIZE</p>
              ) : productStock > 0 ? (
                <p className="text-xs text-stone">IN STOCK · READY TO SHIP</p>
              ) : (
                <p className="text-xs text-stone">CURRENTLY SOLD OUT</p>
              )}
            </div>

            <button
              type="button"
              onClick={handleAdd}
              disabled={authLoading || soldOut}
              className="mt-5 w-full bg-bone py-4 text-xs font-medium tracking-[0.18em] text-void hover:bg-mango disabled:cursor-not-allowed disabled:opacity-40"
            >
              {authLoading ? "PLEASE WAIT…" : soldOut ? "SOLD OUT" : "ADD TO BAG"}
            </button>
            {stockError && <p className="mt-3 text-xs text-mango">{stockError}</p>}
            <Link
              href={`/product/${product.slug}`}
              onClick={onClose}
              className="mt-5 block border border-line-strong py-3.5 text-center text-xs tracking-[0.16em] text-bone hover:border-bone"
            >
              VIEW FULL PRODUCT
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
