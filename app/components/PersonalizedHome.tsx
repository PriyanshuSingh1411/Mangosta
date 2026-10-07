"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import type { Product } from "@/app/data/productTypes";
import {
  getProductSalePrice,
  getProductStrikethroughPrice,
  hasProductDiscount,
  formatPrice,
} from "@/app/data/productTypes";
import { useAuth } from "@/app/components/AuthProvider";
import { useWishlistStore } from "@/app/store/useWishlistStore";

const RECENT_KEY = "mangosta-recently-viewed";

function PersonalizedProductCard({ product }: { product: Product }) {
  const salePrice = getProductSalePrice(product);
  const originalPrice = getProductStrikethroughPrice(product);
  const hasDiscount = hasProductDiscount(product);
  const discountPercent = Math.round(Number(product.discountPercent) || 0);

  return (
    <Link
      href={`/product/${product.slug}`}
      className="group block min-w-0"
    >
      <div className="relative aspect-[3/4] overflow-hidden bg-void">
        {product.images[0] ? (
          <Image
            src={product.images[0]}
            alt={product.name}
            fill
            sizes="(max-width: 639px) 50vw, 25vw"
            className="object-contain transition-transform duration-500 group-hover:scale-[1.02]"
          />
        ) : null}

        {hasDiscount && discountPercent > 0 && (
          <span className="absolute left-3 top-3 z-10 rounded-sm bg-mango px-2 py-1 font-mono text-[9px] font-bold uppercase tracking-[0.12em] text-void">
            {discountPercent}% OFF
          </span>
        )}
      </div>

      <h3 className="mt-3 break-words text-sm font-medium text-bone">
        {product.name}
      </h3>

      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
        {hasDiscount && originalPrice && originalPrice > salePrice && (
          <span className="font-mono text-[10px] text-stone line-through">
            {formatPrice(originalPrice)}
          </span>
        )}
        <span className="font-mono text-xs font-medium text-bone-dim">
          {formatPrice(salePrice)}
        </span>
      </div>

      {hasDiscount && discountPercent > 0 && (
        <span className="mt-1 inline-block rounded-sm bg-mango/10 px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-[0.1em] text-mango">
          SAVE {discountPercent}%
        </span>
      )}
    </Link>
  );
}

export default function PersonalizedHome({ products }: { products: Product[] }) {
  const { user } = useAuth();
  const wishlistIds = useWishlistStore((state) => state.productIds);
  const loadWishlist = useWishlistStore((state) => state.load);
  const [recentIds, setRecentIds] = useState<string[]>([]);

  useEffect(() => {
    if (user) void loadWishlist(user.id);
    try {
      setRecentIds(
        JSON.parse(
          window.localStorage.getItem(RECENT_KEY) || "[]"
        ) as string[]
      );
    } catch {
      setRecentIds([]);
    }
  }, [user, loadWishlist]);

  const recent = useMemo(
    () =>
      recentIds
        .map((id) => products.find((product) => product.id === id))
        .filter(Boolean) as Product[],
    [products, recentIds]
  );

  const recommended = useMemo(() => {
    const categories = new Set(
      recent.map((product) => product.category)
    );

    return products
      .filter(
        (product) =>
          categories.has(product.category) &&
          !recentIds.includes(product.id) &&
          !wishlistIds.includes(product.id)
      )
      .slice(0, 4);
  }, [products, recent, recentIds, wishlistIds]);

  if (!user || (recent.length === 0 && wishlistIds.length === 0)) {
    return null;
  }

  const picks =
    recommended.length > 0
      ? recommended
      : products
          .filter((product) => wishlistIds.includes(product.id))
          .slice(0, 4);

  if (recent.length === 0 && picks.length === 0) {
    return null;
  }

  return (
    <section className="border-y border-line bg-charcoal/40 px-5 py-16 sm:px-8 lg:py-20">
      <div className="mx-auto max-w-[1600px]">
        {recent.length > 0 && (
          <>
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="label-technical text-mango">
                  WELCOME BACK
                </p>
                <h2 className="mt-2 font-display text-4xl tracking-tight text-bone sm:text-5xl">
                  CONTINUE EXPLORING.
                </h2>
                <p className="mt-3 text-sm text-stone">
                  Picks based on what you&apos;ve been exploring.
                </p>
              </div>

              <Link
                href="/shop"
                className="hidden text-xs tracking-[0.15em] text-stone hover:text-bone sm:block"
              >
                SHOP ALL →
              </Link>
            </div>

            <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
              {recent.slice(0, 4).map((product) => (
                <PersonalizedProductCard
                  key={product.id}
                  product={product}
                />
              ))}
            </div>
          </>
        )}

        {picks.length > 0 && (
          <div className="mt-16 border-t border-line pt-12">
            <p className="label-technical text-stone">
              BECAUSE YOU LIKE THESE
            </p>

            <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-4">
              {picks.map((product) => (
                <PersonalizedProductCard
                  key={product.id}
                  product={product}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
