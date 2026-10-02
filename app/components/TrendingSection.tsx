"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import type { Product } from "@/app/data/productTypes";
import {
  formatPrice,
  getProductSalePrice,
  hasProductDiscount,
} from "@/app/data/productTypes";
import ProductQuickAddModal from "./ProductQuickAddModal";

type TrendingSectionProps = {
  products: Product[];
};

export default function TrendingSection({
  products,
}: TrendingSectionProps) {
  const [quickAddProduct, setQuickAddProduct] =
    useState<Product | null>(null);

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
            <p className="label-technical mb-3 text-stone">
              05 — TRENDING
            </p>

            <h2 className="font-display text-4xl uppercase tracking-[-0.04em] text-bone sm:text-6xl">
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
            PRODUCTS
        ============================================================ */}

        {products.length > 0 ? (
          <div className="grid grid-cols-2 gap-px bg-line-strong sm:grid-cols-3 lg:grid-cols-4">
            {products.map((product) => {
              const image =
                product.images?.[0] || "";

              const salePrice =
                getProductSalePrice(product);

              const hasDiscount =
                hasProductDiscount(product);

              const discountPercent =
                Number(product.discountPercent) || 0;

              return (
                <article
                  key={product.id}
                  className="group relative bg-void"
                >
                  {/* ================================================
                      PRODUCT IMAGE
                  ================================================ */}

                  <Link
                    href={`/product/${product.slug}`}
                    className="block"
                  >
                    <div className="relative aspect-[4/5] overflow-hidden bg-charcoal">
                      {image ? (
                        <Image
                          src={image}
                          alt={product.name}
                          fill
                          sizes="(max-width: 639px) 50vw, (max-width: 1023px) 33vw, 25vw"
                          className="object-contain object-center transition-transform duration-700 group-hover:scale-[1.02]"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center bg-charcoal">
                          <span className="font-display text-5xl text-stone/40">
                            M
                          </span>
                        </div>
                      )}

                      {/* DISCOUNT BADGE */}
                      {hasDiscount && (
                        <div className="absolute left-3 top-3 z-10 bg-mango px-2 py-1 text-[9px] font-semibold uppercase tracking-[0.12em] text-void">
                          {discountPercent}% OFF
                        </div>
                      )}
                    </div>
                  </Link>

                  {/* ================================================
                      PRODUCT INFO
                  ================================================ */}

                  <div className="flex items-start justify-between gap-3 bg-void p-3 sm:p-4">
                    <Link
                      href={`/product/${product.slug}`}
                      className="min-w-0 flex-1"
                    >
                      {/* PRODUCT NAME */}

                      <p className="truncate text-xs font-medium uppercase tracking-[0.16em] text-bone sm:text-[10px]">
                        {product.name}
                      </p>

                      {/* COLORS + PRICE */}

                      <div className="mt-2 flex items-start gap-2">
                        {/* COLORS */}

                        <div
                          className="flex shrink-0 gap-1.5 pt-0.5"
                          aria-label={`Available colors: ${product.colors
                            .map((c) => c.name)
                            .join(", ")}`}
                        >
                          {product.colors.map(
                            (color) => (
                              <span
                                key={color.name}
                                className="h-3 w-3 rounded-full border border-line-strong"
                                style={{
                                  backgroundColor:
                                    color.hex,
                                }}
                                title={color.name}
                              />
                            )
                          )}
                        </div>

                        {/* PRICE */}

                        <div className="flex min-w-0 flex-col">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            {/* ORIGINAL PRICE */}

                            {hasDiscount && (
                              <span className="font-mono text-[10px] text-stone-dark line-through">
                                {formatPrice(
                                  product.price
                                )}
                              </span>
                            )}

                            {/* ACTUAL SALE PRICE */}

                            <span className="font-mono text-xs text-bone-dim">
                              {formatPrice(
                                salePrice
                              )}
                            </span>
                          </div>

                          {/* DISCOUNT TEXT */}

                          {hasDiscount && (
                            <span className="mt-1 text-[9px] font-medium uppercase tracking-[0.12em] text-mango">
                              {discountPercent}% OFF
                            </span>
                          )}
                        </div>
                      </div>
                    </Link>

                    {/* ================================================
                        QUICK ADD
                    ================================================ */}

                    <button
                      type="button"
                      onClick={() =>
                        setQuickAddProduct(
                          product
                        )
                      }
                      className="flex h-9 w-9 shrink-0 items-center justify-center border border-line-strong text-xl leading-none text-bone transition-colors hover:border-bone hover:bg-bone hover:text-void"
                      aria-label={`Add ${product.name} to bag`}
                    >
                      +
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="border border-line-strong py-20 text-center text-sm text-stone">
            No products available at the
            moment.
          </div>
        )}
      </div>

      {/* ============================================================
          QUICK ADD MODAL
      ============================================================ */}

      <ProductQuickAddModal
        product={quickAddProduct}
        onClose={() =>
          setQuickAddProduct(null)
        }
      />
    </section>
  );
}