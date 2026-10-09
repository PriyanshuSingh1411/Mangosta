"use client";

import { useEffect, useMemo } from "react";
import Link from "next/link";
import type { Product } from "@/app/data/productTypes";
import { useAuth } from "@/app/components/AuthProvider";
import { useWishlistStore } from "@/app/store/useWishlistStore";
import ProductCard from "./ProductCard";
import { useStoredText } from "@/app/lib/useBrowserValue";

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
  // Recently viewed products, saved in this browser.
  const recentText = useStoredText(RECENT_KEY, "[]");
  const recentIds = useMemo<string[]>(() => {
    try {
      const parsed: unknown = JSON.parse(recentText);
      return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [];
    } catch {
      return [];
    }
  }, [recentText]);

  useEffect(() => {
    if (user) void loadWishlist(user.id);
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
    <section className="border-y border-line bg-charcoal/40 py-16 sm:py-20">
      {/* Same width, side margins and header layout as THE DROP / TRENDING */}
      <div className="mx-auto w-full max-w-[1400px] px-5 sm:px-8 lg:px-12">
        {recent.length > 0 && (
          <>
            <div className="mb-10 flex items-end justify-between gap-6 sm:mb-14">
              <div className="min-w-0">
                <p className="label-technical mb-3 !text-mango">
                  WELCOME BACK
                </p>
                <h2 className="type-title uppercase text-bone">
                  CONTINUE EXPLORING.
                </h2>
                <p className="mt-3 text-sm text-stone">
                  Picks based on what you&apos;ve been exploring.
                </p>
              </div>

              <Link
                href="/shop"
                className="hidden shrink-0 border border-line-strong px-4 py-2 text-[10px] font-medium uppercase tracking-[0.16em] text-bone transition-colors hover:border-bone hover:bg-bone hover:text-void sm:inline-flex"
              >
                SHOP ALL →
              </Link>
            </div>

            <div className={GRID_CLASSES}>
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
            <h3 className="type-heading uppercase text-bone">
              BECAUSE YOU LIKE THESE
            </h3>

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
