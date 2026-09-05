"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import type { Product } from "@/app/data/productTypes";
import { formatPrice } from "@/app/data/productTypes";
import { useCursorHover } from "@/app/lib/useCursorHover";
import ProductPlaceholderArt from "./ProductPlaceholderArt";

export default function ProductCard({ product, index = 0 }: { product: Product; index?: number }) {
  const cardRef = useRef<HTMLDivElement>(null);
  const viewCursor = useCursorHover("view", "VIEW");
  const [imageFailed, setImageFailed] = useState(false);
  const primaryImage = product.images[0];

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const card = cardRef.current;
    if (!card) return;
    const rect = card.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    card.style.setProperty("--tilt-x", `${y * -6}deg`);
    card.style.setProperty("--tilt-y", `${x * 6}deg`);
  };

  const handleMouseLeave = () => {
    const card = cardRef.current;
    if (!card) return;
    card.style.setProperty("--tilt-x", "0deg");
    card.style.setProperty("--tilt-y", "0deg");
  };

  return (
    <Link
      href={`/product/${product.slug}`}
      className="group block"
      {...viewCursor}
      aria-label={`View ${product.name}, ${formatPrice(product.price)}`}
    >
      <div
        ref={cardRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        className="relative aspect-[3/4] overflow-hidden bg-charcoal transition-transform duration-300 ease-out"
        style={{
          transform:
            "perspective(1000px) rotateX(var(--tilt-x, 0deg)) rotateY(var(--tilt-y, 0deg))",
        }}
      >
        {product.isNew && (
          <span className="absolute left-4 top-4 z-10 label-technical !text-mango">NEW</span>
        )}
        <span className="absolute right-4 top-4 z-10 label-technical">
          {String(index + 1).padStart(2, "0")}
        </span>

        <div className="absolute inset-0 transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-[1.08]">
          {primaryImage && !imageFailed ? (
            <Image
              src={primaryImage}
              alt={product.name}
              fill
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
              className="object-cover"
              onError={() => setImageFailed(true)}
            />
          ) : (
            <ProductPlaceholderArt seed={product.id} className="h-full w-full" />
          )}
        </div>

        <div
          className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
          style={{
            background:
              "linear-gradient(to top, rgba(10,10,10,0.88) 0%, rgba(10,10,10,0.1) 55%, transparent 100%)",
          }}
        />

        <div className="absolute inset-x-0 bottom-0 translate-y-4 p-5 opacity-0 transition-all duration-500 ease-out group-hover:translate-y-0 group-hover:opacity-100">
          <div className="flex gap-1.5">
            {product.colors.map((c) => (
              <span
                key={c.name}
                className="h-3 w-3 rounded-full border border-line-strong"
                style={{ backgroundColor: c.hex }}
                title={c.name}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-medium tracking-wide text-bone">{product.name}</h3>
          <p className="mt-1 text-xs text-stone">{categoryLabel(product.category)}</p>
        </div>
        <p className="shrink-0 font-mono text-sm text-bone-dim">{formatPrice(product.price)}</p>
      </div>
    </Link>
  );
}

function categoryLabel(cat: string) {
  const map: Record<string, string> = {
    "t-shirts": "T-Shirts",
    hoodies: "Hoodies",
    pants: "Pants",
    jackets: "Jackets",
    accessories: "Accessories",
  };
  return map[cat] ?? cat;
}
