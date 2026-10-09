"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";

import Navigation from "@/app/components/Navigation";
import EngagementTracker from "@/app/components/EngagementTracker";
import ProductPlaceholderArt from "@/app/components/ProductPlaceholderArt";
import { maxAllowedForLine, useCartStore } from "@/app/store/useCartStore";
import {
  formatPrice,
  getLineImage,
  getProductSalePrice,
  hasProductDiscount,
  getProductStrikethroughPrice,
  getProductSavingsPercent,
} from "@/app/data/productTypes";

export default function BagPage() {
  const {
    lines,
    updateQuantity,
    removeLine,
    clearCart,
    subtotal,
  } = useCartStore();

  const [failedLines, setFailedLines] = useState<Set<string>>(
    new Set()
  );

  useEffect(() => {
    void useCartStore.getState().syncProducts();
  }, []);

  const currentSubtotal = subtotal();

  return (
    <>
    <EngagementTracker
  event="page_view"
  path="/bag"
  metadata={{
    itemCount: lines.reduce(
      (total, line) => total + line.quantity,
      0
    ),
  }}
/>
      <Navigation />

      <main className="min-h-screen bg-void px-5 pb-24 pt-28 sm:px-8 sm:pt-32 lg:px-12">
        <div className="mx-auto max-w-7xl">

          {/* HEADER */}
          <div className="mb-10 flex items-end justify-between border-b border-line pb-6">
            <div>
              <p className="label-technical mb-3">
                SHOPPING BAG
              </p>

              <h1 className="type-title text-bone">
                YOUR BAG
              </h1>
            </div>

            <p className="label-technical text-stone">
              {lines.length} {lines.length === 1 ? "ITEM" : "ITEMS"}
            </p>
          </div>

          {lines.length === 0 ? (
            /* EMPTY BAG */
            <div className="flex min-h-[50vh] flex-col items-center justify-center text-center">
              <p className="label-technical mb-4">
                YOUR BAG IS EMPTY
              </p>

              <p className="mb-8 max-w-md text-sm leading-relaxed text-stone">
                There are currently no items in your bag.
              </p>

              <Link
                href="/shop"
                className="border border-line-strong px-8 py-4 text-xs font-medium tracking-[0.18em] text-bone transition-colors hover:border-bone"
              >
                CONTINUE SHOPPING
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-12 lg:grid-cols-[1fr_380px]">

              {/* PRODUCTS */}
              <section>
                <div className="flex flex-col">
                  {lines.map((line) => (
                    <article
                      key={line.lineId}
                      className="flex gap-4 border-b border-line py-6 first:pt-0 sm:gap-7"
                    >
                      {/* IMAGE */}
                      <Link
                        href={`/product/${line.product.slug}`}
                        className="relative h-32 w-24 shrink-0 overflow-hidden bg-charcoal min-[400px]:h-40 min-[400px]:w-28 sm:h-52 sm:w-36"
                      >
                        {getLineImage(line.product, line.color) &&
                        !failedLines.has(line.lineId) ? (
                          <Image
                            src={getLineImage(line.product, line.color)}
                            alt={line.product.name}
                            fill
                            sizes="144px"
                            className="object-cover"
                            onError={() => {
                              setFailedLines((previous) => {
                                const next = new Set(previous);
                                next.add(line.lineId);
                                return next;
                              });
                            }}
                          />
                        ) : (
                          <ProductPlaceholderArt
                            seed={line.product.id}
                            className="h-full w-full"
                          />
                        )}
                      </Link>

                      {/* DETAILS */}
                      <div className="flex min-w-0 flex-1 flex-col justify-between">

                        <div>
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <Link
                                href={`/product/${line.product.slug}`}
                                className="text-sm font-medium tracking-wide text-bone transition-colors hover:text-mango"
                              >
                                {line.product.name}
                              </Link>

                              <p className="mt-2 text-xs text-stone">
                                {line.color} / {line.size}
                              </p>
                            </div>

                            <div className="shrink-0 text-right">
                              {getProductStrikethroughPrice(line.product) && (
                                <p className="font-body tabular-nums text-xs text-stone-dark line-through">
                                  {formatPrice((getProductStrikethroughPrice(line.product) || 0) * line.quantity)}
                                </p>
                              )}
                              <p className={`type-price text-sm ${hasProductDiscount(line.product) ? "text-mango font-semibold" : "text-bone"}`}>
                                {formatPrice(
                                  getProductSalePrice(line.product) * line.quantity
                                )}
                              </p>
                              {getProductSavingsPercent(line.product) !== null && (
                                <p className="mt-1 inline-block rounded-sm bg-mango/10 px-1.5 py-[3px] text-[10px] font-semibold uppercase leading-none tracking-[0.08em] text-mango">
                                  Save {getProductSavingsPercent(line.product)}%
                                </p>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* QUANTITY + REMOVE */}
                        {/* wraps REMOVE under the stepper on very narrow phones */}
                        <div className="mt-6 flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
                          <div className="flex items-center border border-line-strong">
                            <button
                              type="button"
                              onClick={() =>
                                updateQuantity(
                                  line.lineId,
                                  line.quantity - 1
                                )
                              }
                              disabled={line.quantity <= 1}
                              className="flex h-10 w-10 items-center justify-center text-stone transition-colors hover:text-bone disabled:cursor-not-allowed disabled:opacity-30"
                            >
                              −
                            </button>

                            <span className="flex h-10 w-10 items-center justify-center border-x border-line-strong font-mono text-xs text-bone">
                              {line.quantity}
                            </span>

                            <button
                              type="button"
                              onClick={() =>
                                updateQuantity(
                                  line.lineId,
                                  line.quantity + 1
                                )
                              }
                              aria-label="Increase quantity"
                              disabled={line.quantity >= maxAllowedForLine(lines, line.product, line.size, line.color, line.lineId)}
                              className="flex h-10 w-10 items-center justify-center text-stone transition-colors hover:text-bone disabled:cursor-not-allowed disabled:opacity-30"
                            >
                              +
                            </button>
                          </div>

                          <button
                            type="button"
                            onClick={() =>
                              removeLine(line.lineId)
                            }
                            className="label-technical text-stone transition-colors hover:text-mango"
                          >
                            REMOVE
                          </button>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>

                {/* CLEAR BAG */}
                <div className="mt-6">
                  <button
                    type="button"
                    onClick={clearCart}
                    className="label-technical text-stone transition-colors hover:text-mango"
                  >
                    CLEAR BAG
                  </button>
                </div>
              </section>

              {/* SUMMARY */}
              <aside className="h-fit border border-line bg-charcoal p-6 sm:p-8 lg:sticky lg:top-28">
                <p className="label-technical mb-8">
                  ORDER SUMMARY
                </p>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="label-technical text-stone">
                      SUBTOTAL
                    </span>

                    <span className="type-price text-sm text-bone">
                      {formatPrice(currentSubtotal)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="label-technical text-stone">
                      SHIPPING
                    </span>

                    <span className="text-xs text-stone">
                      CALCULATED AT CHECKOUT
                    </span>
                  </div>
                </div>

                <div className="my-6 border-t border-line" />

                <div className="mb-8 flex items-center justify-between">
                  <span className="label-technical">
                    TOTAL
                  </span>

                  <span className="type-price text-lg text-bone">
                    {formatPrice(currentSubtotal)}
                  </span>
                </div>

                <Link
                  href="/checkout"
                  className="block w-full bg-bone py-4 text-center text-xs font-medium tracking-[0.18em] text-void transition-colors hover:bg-mango"
                >
                  PROCEED TO CHECKOUT
                </Link>

                <Link
                  href="/shop"
                  className="mt-3 block w-full border border-line-strong py-4 text-center text-xs font-medium tracking-[0.18em] text-bone transition-colors hover:border-bone"
                >
                  CONTINUE SHOPPING
                </Link>
              </aside>
            </div>
          )}
        </div>
      </main>
    </>
  );
}