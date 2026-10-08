"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { Product } from "@/app/data/productTypes";
import { useAuth } from "@/app/components/AuthProvider";
import { useWishlistStore } from "@/app/store/useWishlistStore";
import ProductCard from "./ProductCard";

const RECENT_KEY = "mangosta-recently-viewed";

/*
 * Same grid as every product listing on the site:
 * phones  → 2 columns, edge to edge, 4px gap
 * tablet+ → 4 columns with roomier gaps
 */
const GRID_CLASSES =
  "-mx-5 grid grid-cols-2 gap-x-1 gap-y-8 sm:mx-0 sm:gap-x-4 sm:gap-y-12 md:grid-cols-4";

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

            <div className={`mt-8 ${GRID_CLASSES}`}>
              {recent.slice(0, 4).map((product) => (
                <ProductCard
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

            <div className={`mt-6 ${GRID_CLASSES}`}>
              {picks.map((product) => (
                <ProductCard
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
