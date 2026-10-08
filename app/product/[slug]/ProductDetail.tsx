"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import type { Product, ProductColor } from "@/app/data/productTypes";
import {
  formatPrice,
  getColorImages,
  getProductSalePrice,
  getProductSizes,
  getVariantStock,
  hasProductDiscount,
  getProductStrikethroughPrice,
} from "@/app/data/productTypes";
import type { ReviewSummary, ReturnsPolicy } from "@/app/data/storeTypes";
import { maxAllowedForLine, useCartStore } from "@/app/store/useCartStore";
import { useAuth } from "@/app/components/AuthProvider";
import { flyToBag } from "@/app/lib/flyToBag";
import { trackEngagement } from "@/app/lib/trackEngagement";
import ProductPlaceholderArt from "@/app/components/ProductPlaceholderArt";
import WishlistButton from "@/app/components/WishlistButton";
import SizeGuideLink from "@/app/components/SizeGuide";
import PincodeCheck from "@/app/components/PincodeCheck";
import NotifyMe from "@/app/components/NotifyMe";
import StarRating from "@/app/components/StarRating";
import ProductReviews from "./ProductReviews";
import { useToast } from "@/app/components/ToastProvider";

/** Shown as "Only N left" when a size/colour is at or below this. */
const LOW_STOCK = 3;

export default function ProductDetail({
  product,
  reviewSummary,
  returnsPolicy,
}: {
  product: Product;
  reviewSummary?: ReviewSummary;
  returnsPolicy?: ReturnsPolicy;
}) {
  const [selectedColor, setSelectedColor] = useState<ProductColor | undefined>(product.colors[0]);
  const [selectedSize, setSelectedSize] = useState<string | null>(
    getProductSizes(product).length === 1 ? getProductSizes(product)[0] : null
  );
  const [quantity, setQuantity] = useState(1);
  const [sizeError, setSizeError] = useState(false);
  const [stockError, setStockError] = useState<string | null>(null);
  const [justAdded, setJustAdded] = useState(false);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set());
  const [imageAspectRatio, setImageAspectRatio] = useState(2 / 3);
  const [shareLabel, setShareLabel] = useState("SHARE");

  const imageRef = useRef<HTMLDivElement>(null);
  const addToBag = useCartStore((s) => s.addToBag);
  const { user, loading: authLoading, openAuth } = useAuth();
  const openBag = useCartStore((s) => s.openBag);
  const { toast } = useToast();

  const colorName = selectedColor?.name ?? "";
  const sizes = getProductSizes(product);
  const images = getColorImages(product, colorName);
  const activeImage = images[Math.min(activeImageIndex, Math.max(0, images.length - 1))];
  const salePrice = getProductSalePrice(product);
  const hasDiscount = hasProductDiscount(product);
  const discountPercent = Number(product.discountPercent) || 0;
  const activeImageFailed = activeImage ? failedImages.has(activeImage) : true;

  const selectedStock = selectedSize ? getVariantStock(product, colorName, selectedSize) : 0;
  const selectedSoldOut = Boolean(selectedSize) && selectedStock <= 0;
  const productSoldOut = (Number(product.inventory) || 0) <= 0;

  useEffect(() => {
    images.slice(0, 4).forEach((src) => { const img = new window.Image(); img.src = src; });
  }, [images]);

  useEffect(() => {
    try {
      const current = JSON.parse(window.localStorage.getItem("mangosta-recently-viewed") || "[]") as string[];
      const next = [product.id, ...current.filter((id) => id !== product.id)].slice(0, 8);
      window.localStorage.setItem("mangosta-recently-viewed", JSON.stringify(next));
    } catch {}
  }, [product.id]);

  const chooseColor = (color: ProductColor) => {
    setSelectedColor(color);
    setActiveImageIndex(0);
    setQuantity(1);
    setStockError(null);
  };

  const chooseSize = (size: string) => {
    setSelectedSize(size);
    setSizeError(false);
    setStockError(null);
    setQuantity(1);
  };

  const handleShare = async () => {
    const url = window.location.href;
    const recordShare = (method: "native_share" | "copy_link") =>
      void trackEngagement({
        event: "product_share",
        productId: product.id,
        metadata: {
          method,
          productName: product.name,
          category: product.category,
        },
      });

    try {
      if (navigator.share) {
        await navigator.share({
          title: `${product.name} — MANGOSTA`,
          text: product.description || `Check out ${product.name} from MANGOSTA.`,
          url,
        });
        setShareLabel("SHARED ✓");
        recordShare("native_share");
      } else {
        await navigator.clipboard.writeText(url);
        setShareLabel("LINK COPIED ✓");
        recordShare("copy_link");
      }
    } catch {
      // A user closing the native share sheet is not an error.
    } finally {
      window.setTimeout(() => setShareLabel("SHARE"), 1800);
    }
  };

  const addProductToBag = () => {
    if (!selectedSize) return;

    const state = useCartStore.getState();
    const lineId = `${product.id}-${selectedSize}-${colorName}`;
    const inBag = state.lines.find((line) => line.lineId === lineId)?.quantity ?? 0;
    const allowed = maxAllowedForLine(state.lines, product, selectedSize, colorName, lineId);

    if (inBag + quantity > allowed) {
      setStockError(
        allowed - inBag > 0
          ? `Only ${allowed - inBag} more can be added — ${inBag} already in your bag.`
          : allowed > 0
            ? `All ${allowed} available are already in your bag.`
            : "This size just sold out."
      );
      return;
    }

    addToBag(product, selectedSize, colorName, quantity);

    if (imageRef.current) {
      flyToBag(imageRef.current, () => {
        setJustAdded(true);
    toast(`${product.name} added to your bag`, "success");
        setTimeout(() => setJustAdded(false), 1800);
      });
    } else {
      openBag();
    }
  };

  const handleAddToBag = () => {
    if (!selectedSize) {
      setSizeError(true);
      return;
    }

    setSizeError(false);

    if (authLoading || selectedSoldOut) return;

    if (!user) {
      openAuth("signin", addProductToBag);
      return;
    }

    addProductToBag();
  };

  return (
    <div className="grid grid-cols-1 items-start gap-10 lg:grid-cols-2 lg:gap-14">
      {/* Left: product imagery (changes with the chosen colour) */}
      <div className="flex min-w-0 flex-col gap-3">
        <div
          ref={imageRef}
          className="relative mx-auto flex w-full max-w-[550px] items-center justify-center overflow-hidden"
          style={{
            aspectRatio: imageAspectRatio,
            maxHeight: "550px",
          }}
        >
          {activeImage && !activeImageFailed ? (
            <Image
              key={activeImage}
              src={activeImage}
              alt={`${product.name}${colorName ? ` — ${colorName}` : ""}`}
              fill
              sizes="(max-width: 1024px) 100vw, 550px"
              className="object-contain"
              priority={activeImageIndex === 0}
              onLoad={(event) => {
                const image = event.currentTarget;
                if (image.naturalWidth && image.naturalHeight) {
                  setImageAspectRatio(image.naturalWidth / image.naturalHeight);
                }
              }}
              onError={() =>
                setFailedImages((prev) => new Set(prev).add(activeImage))
              }
            />
          ) : (
            <ProductPlaceholderArt
              seed={product.id + colorName}
              className="h-full w-full"
            />
          )}

          {productSoldOut && (
            <span className="absolute left-3 top-3 bg-void/80 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.16em] text-bone">
              Sold out
            </span>
          )}
        </div>

        {images.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {images.map((img, i) => (
              <button
                key={img + i}
                type="button"
                onClick={() => setActiveImageIndex(i)}
                aria-label={`View image ${i + 1} of ${images.length}`}
                aria-pressed={activeImageIndex === i}
                className={`relative h-16 w-14 shrink-0 overflow-hidden border transition-colors ${
                  activeImageIndex === i
                    ? "border-mango"
                    : "border-line-strong hover:border-bone-dim"
                }`}
              >
                {!failedImages.has(img) ? (
                  <Image
                    src={img}
                    alt=""
                    fill
                    sizes="56px"
                    className="object-cover"
                    onError={() => setFailedImages((prev) => new Set(prev).add(img))}
                  />
                ) : (
                  <ProductPlaceholderArt seed={product.id + i} className="h-full w-full" />
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Right: info */}
      <div className="flex min-w-0 flex-col">
        {/* Phones: the name gets the full width (Share / ♡ go just below)
            so words never break in the middle. 640px+: side by side. */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <h1 className="min-w-0 font-display text-[clamp(1.75rem,8.5vw,2.25rem)] leading-[0.95] tracking-tight text-bone sm:text-5xl lg:text-4xl xl:text-5xl">
            {product.name}
          </h1>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => void handleShare()}
              aria-label={`Share ${product.name}`}
              className="flex h-11 items-center justify-center border border-line-strong px-3 text-[10px] font-medium tracking-[0.14em] text-bone-dim transition-colors hover:border-mango hover:text-mango"
            >
              {shareLabel}
            </button>
            <WishlistButton
              productId={product.id}
              productName={product.name}
              className="h-11 w-11 border border-line-strong hover:border-bone"
            />
          </div>
        </div>

        {reviewSummary && reviewSummary.count > 0 && (
          <a href="#reviews" className="mt-3 inline-flex w-fit items-center gap-2 text-xs text-stone transition-colors hover:text-bone">
            <StarRating value={reviewSummary.average} />
            <span>
              {reviewSummary.average.toFixed(1)} · {reviewSummary.count} review{reviewSummary.count === 1 ? "" : "s"}
            </span>
          </a>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-3">
          {getProductStrikethroughPrice(product) && getProductStrikethroughPrice(product) !== salePrice ? (
            <>
              <span className="font-mono text-sm text-stone-dark line-through">
                {formatPrice(getProductStrikethroughPrice(product) || 0)}
              </span>
              <span className={`font-mono text-xl ${hasDiscount ? "text-mango font-semibold" : "text-bone-dim"}`}>
                {formatPrice(salePrice)}
              </span>
              {hasDiscount && (
                <span className="text-xs font-medium tracking-wider text-mango bg-mango/10 px-2 py-1 rounded">
                  {discountPercent}% OFF
                </span>
              )}
            </>
          ) : (
            <>
              <span className="font-mono text-xl text-bone-dim">
                {formatPrice(salePrice)}
              </span>
            </>
          )}
        </div>

        <p className="mt-6 max-w-md text-sm leading-relaxed text-stone">{product.description}</p>

        <div className="hairline my-8" />

        {product.colors.length > 0 && (
          <div className="mb-8">
            <p className="label-technical mb-3">
              COLOR — <span className="text-bone-dim">{colorName}</span>
            </p>
            <div className="flex flex-wrap gap-3">
              {product.colors.map((color) => (
                <button
                  key={color.name}
                  type="button"
                  onClick={() => chooseColor(color)}
                  aria-label={color.name}
                  aria-pressed={colorName === color.name}
                  className={`h-9 w-9 rounded-full border-2 transition-all ${
                    colorName === color.name
                      ? "border-mango scale-110"
                      : "border-line-strong hover:border-bone-dim"
                  }`}
                  style={{ backgroundColor: color.hex }}
                />
              ))}
            </div>
          </div>
        )}

        <div className="mb-8">
          <div className="mb-3 flex items-center justify-between gap-4">
            <p className="label-technical">
              SIZE {sizeError && <span className="text-mango">— PLEASE SELECT A SIZE</span>}
            </p>
            <SizeGuideLink category={product.category} />
          </div>
          <div className="flex flex-wrap gap-2">
            {sizes.map((size) => {
              const soldOut = getVariantStock(product, colorName, size) <= 0;
              return (
                <button
                  key={size}
                  type="button"
                  onClick={() => chooseSize(size)}
                  aria-pressed={selectedSize === size}
                  aria-label={soldOut ? `${size} — sold out` : size}
                  className={`min-w-[3rem] border px-3 py-2.5 text-xs font-medium tracking-wide transition-all ${
                    selectedSize === size
                      ? soldOut
                        ? "border-bone text-stone line-through"
                        : "border-bone bg-bone text-void"
                      : soldOut
                        ? "border-line text-stone-dark line-through hover:border-line-strong"
                        : sizeError
                          ? "border-mango text-bone-dim"
                          : "border-line-strong text-bone-dim hover:border-bone hover:text-bone"
                  }`}
                >
                  {size}
                </button>
              );
            })}
          </div>

          {selectedSize && !selectedSoldOut && selectedStock <= LOW_STOCK && (
            <p className="mt-3 text-xs font-medium text-mango">Only {selectedStock} left in this size</p>
          )}
        </div>

        {selectedSoldOut && selectedSize ? (
          <NotifyMe productId={product.id} color={colorName} size={selectedSize} className="mb-8" />
        ) : (
          <>
            <div className="mb-10">
              <p className="label-technical mb-3">QUANTITY</p>
              <div className="flex w-fit items-center border border-line-strong">
                <button
                  type="button"
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  aria-label="Decrease quantity"
                  className="flex h-11 w-11 items-center justify-center text-bone-dim transition-colors hover:text-bone"
                >
                  −
                </button>
                <span className="w-10 text-center font-mono text-sm text-bone">{quantity}</span>
                <button
                  type="button"
                  onClick={() =>
                    setQuantity((q) =>
                      Math.min(
                        Math.max(1, selectedSize ? selectedStock : Number(product.inventory) || 1),
                        q + 1
                      )
                    )
                  }
                  aria-label="Increase quantity"
                  className="flex h-11 w-11 items-center justify-center text-bone-dim transition-colors hover:text-bone"
                >
                  +
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={handleAddToBag}
              disabled={productSoldOut}
              className="relative overflow-hidden bg-bone py-4 text-center text-xs font-medium tracking-[0.2em] text-void transition-colors hover:bg-mango disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-bone"
            >
              {productSoldOut ? "SOLD OUT" : justAdded ? "ADDED TO BAG ✓" : "ADD TO BAG"}
            </button>
            {stockError && (
              <p role="alert" className="mt-3 text-xs text-mango">{stockError}</p>
            )}
          </>
        )}

        <PincodeCheck className="mt-8" />

        <div className="hairline my-8" />

        <details className="group border-b border-line">
          <summary
            className="label-technical flex cursor-pointer list-none items-center justify-between py-4"
          >
            DETAILS &amp; CARE
            <span className="transition-transform group-open:rotate-45">+</span>
          </summary>
          <ul className="pb-5 flex flex-col gap-2 text-sm text-stone">
            {product.details.map((d) => (
              <li key={d} className="flex gap-2">
                <span className="text-mango">—</span>
                {d}
              </li>
            ))}
          </ul>
        </details>

        <details className="group border-b border-line">
          <summary
            className="label-technical flex cursor-pointer list-none items-center justify-between py-4"
          >
            REVIEWS
            <span className="transition-transform group-open:rotate-45">+</span>
          </summary>
          <div className="pb-5">
            <ProductReviews productId={product.id} productName={product.name} />
          </div>
        </details>

        {returnsPolicy?.enabled && (
          <details className="group border-b border-line">
            <summary
              className="label-technical flex cursor-pointer list-none items-center justify-between py-4"
            >
              RETURNS &amp; EXCHANGES
              <span className="transition-transform group-open:rotate-45">+</span>
            </summary>
            <div className="pb-5 text-sm leading-relaxed text-stone">
              <p className="text-bone-dim">
                {returnsPolicy.allowReturns && returnsPolicy.allowExchanges
                  ? `Returns and exchanges are available within ${returnsPolicy.windowDays} days of delivery.`
                  : returnsPolicy.allowReturns
                    ? `Returns are available within ${returnsPolicy.windowDays} days of delivery.`
                    : returnsPolicy.allowExchanges
                      ? `Exchanges are available within ${returnsPolicy.windowDays} days of delivery.`
                      : "Returns and exchanges are currently unavailable."}
              </p>
              {returnsPolicy.policyText && (
                <p className="mt-3 whitespace-pre-line text-stone">{returnsPolicy.policyText}</p>
              )}
              {(returnsPolicy.allowReturns || returnsPolicy.allowExchanges) && (
                <div className="mt-4 flex flex-wrap gap-2 text-[11px] uppercase tracking-[0.12em] text-stone">
                  {returnsPolicy.allowReturns && (
                    <span className="border border-line-strong px-2.5 py-1.5">Returns</span>
                  )}
                  {returnsPolicy.allowExchanges && (
                    <span className="border border-line-strong px-2.5 py-1.5">Exchanges</span>
                  )}
                  <span className="border border-line-strong px-2.5 py-1.5">{returnsPolicy.windowDays} day window</span>
                </div>
              )}
            </div>
          </details>
        )}
      </div>
    </div>
  );
}