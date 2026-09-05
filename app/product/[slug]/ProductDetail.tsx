"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import { useRef, useState } from "react";
import type { Product } from "@/app/data/productTypes";
import { formatPrice } from "@/app/data/productTypes";
import { useCartStore } from "@/app/store/useCartStore";
import { useAuth } from "@/app/components/AuthProvider";
import { useCursorHover } from "@/app/lib/useCursorHover";
import { useWebGLSupport } from "@/app/lib/useWebGLSupport";
import { flyToBag } from "@/app/lib/flyToBag";
import ProductPlaceholderArt from "@/app/components/ProductPlaceholderArt";

const ProductViewer3D = dynamic(() => import("@/app/components/three/ProductViewer3D"), {
  ssr: false,
});

export default function ProductDetail({ product }: { product: Product }) {
  const [selectedColor, setSelectedColor] = useState(product.colors[0]);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [sizeError, setSizeError] = useState(false);
  const [viewMode, setViewMode] = useState<"image" | "3d">("image");
  const [justAdded, setJustAdded] = useState(false);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [failedImages, setFailedImages] = useState<Set<number>>(new Set());

  const imageRef = useRef<HTMLDivElement>(null);
  const addToBag = useCartStore((s) => s.addToBag);
  const { user, loading: authLoading, openAuth } = useAuth();
  const openBag = useCartStore((s) => s.openBag);
  const shopCursor = useCursorHover("shop", "SHOP");
  const dragCursor = useCursorHover("drag", "DRAG");
  const viewCursor = useCursorHover("view", "VIEW");
  const webglSupported = useWebGLSupport();

  const activeImage = product.images[activeImageIndex];
  const activeImageFailed = failedImages.has(activeImageIndex);

  const addProductToBag = () => {
    addToBag(product, selectedSize!, selectedColor.name, quantity);

    if (imageRef.current) {
      flyToBag(imageRef.current, () => {
        setJustAdded(true);
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

    if (authLoading) {
      return;
    }

    if (!user) {
      openAuth("signin", addProductToBag);
      return;
    }

    addProductToBag();
  };

  return (
    <div className="grid grid-cols-1 gap-12 lg:grid-cols-2 lg:gap-16">
      {/* Left: imagery / 3D */}
      <div className="flex flex-col gap-3">
        <div
          ref={imageRef}
          className="relative aspect-[3/4] w-full overflow-hidden bg-charcoal"
          style={{
            backgroundColor: viewMode === "3d" ? "#141311" : undefined,
            transition: "background-color 0.4s ease",
          }}
          {...(viewMode === "3d" ? dragCursor : {})}
        >
          {viewMode === "image" && (
            activeImage && !activeImageFailed ? (
              <Image
                src={activeImage}
                alt={`${product.name} — ${selectedColor.name}`}
                fill
                sizes="(max-width: 1024px) 100vw, 50vw"
                className="object-cover"
                priority={activeImageIndex === 0}
                onError={() =>
                  setFailedImages((prev) => new Set(prev).add(activeImageIndex))
                }
              />
            ) : (
              <ProductPlaceholderArt seed={product.id + selectedColor.name} className="h-full w-full" />
            )
          )}
          {viewMode === "3d" && webglSupported && (
            <ProductViewer3D colorHex={selectedColor.hex} />
          )}
          {viewMode === "3d" && webglSupported === false && (
            <div className="flex h-full items-center justify-center text-sm text-stone">
              3D preview unavailable on this device
            </div>
          )}
        </div>

        {viewMode === "image" && product.images.length > 1 && (
          <div className="flex gap-2">
            {product.images.map((img, i) => (
              <button
                key={img + i}
                type="button"
                onClick={() => setActiveImageIndex(i)}
                aria-label={`View image ${i + 1} of ${product.images.length}`}
                aria-pressed={activeImageIndex === i}
                className={`relative h-16 w-14 shrink-0 overflow-hidden border transition-colors ${
                  activeImageIndex === i
                    ? "border-mango"
                    : "border-line-strong hover:border-bone-dim"
                }`}
              >
                {!failedImages.has(i) ? (
                  <Image
                    src={img}
                    alt=""
                    fill
                    sizes="56px"
                    className="object-cover"
                    onError={() => setFailedImages((prev) => new Set(prev).add(i))}
                  />
                ) : (
                  <ProductPlaceholderArt seed={product.id + i} className="h-full w-full" />
                )}
              </button>
            ))}
          </div>
        )}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setViewMode("image")}
            className={`flex-1 py-2.5 text-xs tracking-[0.12em] transition-colors ${
              viewMode === "image"
                ? "bg-bone text-void"
                : "border border-line-strong text-bone-dim hover:text-bone"
            }`}
          >
            IMAGE
          </button>
          <button
            type="button"
            onClick={() => setViewMode("3d")}
            className={`flex-1 py-2.5 text-xs tracking-[0.12em] transition-colors ${
              viewMode === "3d"
                ? "bg-bone text-void"
                : "border border-line-strong text-bone-dim hover:text-bone"
            }`}
          >
            360° VIEW
          </button>
        </div>
      </div>

      {/* Right: info */}
      <div className="flex flex-col">
        {product.dropLabel && <p className="label-technical mb-4">{product.dropLabel}</p>}
        <h1 className="font-display text-4xl leading-[0.95] tracking-tight text-bone sm:text-5xl">
          {product.name}
        </h1>
        <p className="mt-4 font-mono text-xl text-bone-dim">
          {formatPrice(product.price)}
          {product.compareAtPrice && (
            <span className="ml-3 text-sm text-stone-dark line-through">
              {formatPrice(product.compareAtPrice)}
            </span>
          )}
        </p>

        <p className="mt-6 max-w-md text-sm leading-relaxed text-stone">{product.description}</p>

        <div className="hairline my-8" />

        {/* Color selector */}
        <div className="mb-8">
          <p className="label-technical mb-3">
            COLOR — <span className="text-bone-dim">{selectedColor.name}</span>
          </p>
          <div className="flex gap-3">
            {product.colors.map((color) => (
              <button
                key={color.name}
                type="button"
                onClick={() => setSelectedColor(color)}
                aria-label={color.name}
                aria-pressed={selectedColor.name === color.name}
                className={`h-9 w-9 rounded-full border-2 transition-all ${
                  selectedColor.name === color.name
                    ? "border-mango scale-110"
                    : "border-line-strong hover:border-bone-dim"
                }`}
                style={{ backgroundColor: color.hex }}
              />
            ))}
          </div>
        </div>

        {/* Size selector */}
        <div className="mb-8">
          <p className="label-technical mb-3">
            SIZE {sizeError && <span className="text-mango">— PLEASE SELECT A SIZE</span>}
          </p>
          <div className="flex flex-wrap gap-2">
            {product.sizes.map((size) => (
              <button
                key={size}
                type="button"
                onClick={() => {
                  setSelectedSize(size);
                  setSizeError(false);
                }}
                aria-pressed={selectedSize === size}
                className={`min-w-[3rem] border px-3 py-2.5 text-xs font-medium tracking-wide transition-all ${
                  selectedSize === size
                    ? "border-bone bg-bone text-void"
                    : sizeError
                    ? "border-mango text-bone-dim"
                    : "border-line-strong text-bone-dim hover:border-bone hover:text-bone"
                }`}
              >
                {size}
              </button>
            ))}
          </div>
        </div>

        {/* Quantity */}
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
              onClick={() => setQuantity((q) => Math.min(product.inventory, q + 1))}
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
          {...shopCursor}
          className="relative overflow-hidden bg-bone py-4 text-center text-xs font-medium tracking-[0.2em] text-void transition-colors hover:bg-mango"
        >
          {justAdded ? "ADDED TO BAG ✓" : "ADD TO BAG"}
        </button>

        <div className="hairline my-8" />

        <details className="group">
          <summary
            className="label-technical flex cursor-pointer list-none items-center justify-between py-2"
            {...viewCursor}
          >
            DETAILS &amp; CARE
            <span className="transition-transform group-open:rotate-45">+</span>
          </summary>
          <ul className="mt-3 flex flex-col gap-2 text-sm text-stone">
            {product.details.map((d) => (
              <li key={d} className="flex gap-2">
                <span className="text-mango">—</span>
                {d}
              </li>
            ))}
          </ul>
        </details>
      </div>
    </div>
  );
}
