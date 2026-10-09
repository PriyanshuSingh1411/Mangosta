"use client";

import Link from "next/link";
import type { Product } from "@/app/data/productTypes";
import ProductCard from "./ProductCard";

type TrendingSectionProps = {
  products: Product[];
};

export default function TrendingSection({
  products,
}: TrendingSectionProps) {
  return (
    <section
      id="trending"
      className="relative overflow-hidden bg-void py-20 sm:py-28"
    >
      <div className="mx-auto w-full max-w-[1400px] px-5 sm:px-8 lg:px-12">
        {/* ============================================================
            HEADER
        ============================================================ */}

        <div className="mb-10 flex items-end justify-between gap-6 sm:mb-14">
          <div>

            <h2 className="type-title uppercase text-bone">
              TRENDING
            </h2>
          </div>

          <Link
            href="/shop"
            className="hidden border border-line-strong px-4 py-2 text-[10px] font-medium uppercase tracking-[0.16em] text-bone transition-colors hover:border-bone hover:bg-bone hover:text-void sm:inline-flex"
          >
            SHOP ALL →
          </Link>
        </div>

        {/* ============================================================
            PRODUCTS — shared site-wide product card
            phones  → 2 columns, edge to edge, 4px gap
            tablet+ → normal page padding, roomier gaps
        ============================================================ */}

        {products.length > 0 ? (
          <div className="-mx-5 grid grid-cols-2 gap-x-1 gap-y-8 sm:mx-0 sm:grid-cols-3 sm:gap-x-4 sm:gap-y-12 lg:grid-cols-4">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        ) : (
          <div className="border border-line-strong py-20 text-center text-sm text-stone">
            No products available at the
            moment.
          </div>
        )}
      </div>
    </section>
  );
}
