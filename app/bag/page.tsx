"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";

import Navigation from "@/app/components/Navigation";
import ProductPlaceholderArt from "@/app/components/ProductPlaceholderArt";
import { useCartStore } from "@/app/store/useCartStore";
import { formatPrice } from "@/app/data/productTypes";

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

  const currentSubtotal = subtotal();

  return (
    <>
      <Navigation />

      <main className="min-h-screen bg-void px-6 pb-20 pt-28 sm:px-10 lg:px-12">
        <div className="mx-auto max-w-7xl">

          {/* HEADER */}
          <div className="mb-10 flex items-end justify-between border-b border-line pb-6">
            <div>
              <p className="label-technical mb-3">
                SHOPPING BAG
              </p>

              <h1 className="font-display text-4xl tracking-tight text-bone sm:text-5xl">
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
                      className="flex gap-5 border-b border-line py-6 first:pt-0 sm:gap-7"
                    >
                      {/* IMAGE */}
                      <Link
                        href={`/product/${line.product.slug}`}
                        className="relative h-40 w-28 shrink-0 overflow-hidden bg-charcoal sm:h-52 sm:w-36"
                      >
                        {line.product.images[0] &&
                        !failedLines.has(line.lineId) ? (
                          <Image
                            src={line.product.images[0]}
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

                            <p className="shrink-0 font-mono text-sm text-bone">
                              {formatPrice(
                                line.product.price * line.quantity
                              )}
                            </p>
                          </div>
                        </div>

                        {/* QUANTITY + REMOVE */}
                        <div className="mt-6 flex items-center justify-between">
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
                              className="flex h-10 w-10 items-center justify-center text-stone transition-colors hover:text-bone"
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

                    <span className="font-mono text-sm text-bone">
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

                  <span className="font-mono text-lg text-bone">
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