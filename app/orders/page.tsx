"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";

import Navigation from "@/app/components/Navigation";
import ProductPlaceholderArt from "@/app/components/ProductPlaceholderArt";
import { formatPrice } from "@/app/data/productTypes";

type OrderLine = {
  lineId: string;
  productId: string;
  productName: string;
  slug: string;
  image: string;
  size: string;
  color: string;
  quantity: number;
  price: number;
};

type Order = {
  id: string;
  createdAt: string;
  status: "pending" | "fulfilled" | "cancelled";
  customer: {
    email: string;
    firstName: string;
    lastName: string;
    address: string;
    city: string;
    postalCode: string;
  };
  lines: OrderLine[];
  subtotal: number;
  shipping: number;
  total: number;
};

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [failedImages, setFailedImages] = useState<Set<string>>(
    new Set()
  );

  useEffect(() => {
    let cancelled = false;

    async function loadOrders() {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch("/api/orders", {
          method: "GET",
          cache: "no-store",
        });

        const data = await response.json().catch(() => null);

        if (!response.ok) {
          throw new Error(
            data?.error || "Unable to load your orders."
          );
        }

        if (!cancelled) {
          setOrders(
            Array.isArray(data?.orders)
              ? data.orders
              : []
          );
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Unable to load your orders."
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadOrders();

    return () => {
      cancelled = true;
    };
  }, []);

  const formatDate = (date: string) => {
    return new Intl.DateTimeFormat("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(new Date(date));
  };

  const statusLabel = (status: Order["status"]) => {
    switch (status) {
      case "fulfilled":
        return "FULFILLED";
      case "cancelled":
        return "CANCELLED";
      default:
        return "PROCESSING";
    }
  };

  const statusClass = (status: Order["status"]) => {
    switch (status) {
      case "fulfilled":
        return "text-bone";
      case "cancelled":
        return "text-stone";
      default:
        return "text-mango";
    }
  };

  return (
    <>
      <Navigation />

      <main className="min-h-screen bg-void px-6 pb-20 pt-28 sm:px-10 lg:px-12">
        <div className="mx-auto max-w-7xl">

          {/* HEADER */}
          <div className="mb-10 border-b border-line pb-7">
            <p className="label-technical mb-3">
              MANGOSTA / ACCOUNT
            </p>

            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
              <div>
                <h1 className="font-display text-4xl tracking-tight text-bone sm:text-5xl">
                  YOUR ORDERS
                </h1>

                <p className="mt-3 max-w-lg text-sm leading-relaxed text-stone">
                  View your previous MANGOSTA purchases and
                  track their status.
                </p>
              </div>

              {!loading && (
                <p className="label-technical text-stone">
                  {orders.length}{" "}
                  {orders.length === 1 ? "ORDER" : "ORDERS"}
                </p>
              )}
            </div>
          </div>

          {/* LOADING */}
          {loading && (
            <div className="flex min-h-[40vh] items-center justify-center">
              <p className="label-technical animate-pulse text-stone">
                LOADING ORDERS…
              </p>
            </div>
          )}

          {/* ERROR */}
          {!loading && error && (
            <div className="flex min-h-[40vh] flex-col items-center justify-center text-center">
              <p className="label-technical mb-4 text-mango">
                UNABLE TO LOAD ORDERS
              </p>

              <p className="max-w-md text-sm leading-relaxed text-stone">
                {error}
              </p>

              <button
                type="button"
                onClick={() => window.location.reload()}
                className="mt-7 border border-line-strong px-7 py-3 text-xs tracking-[0.16em] text-bone transition-colors hover:border-bone"
              >
                TRY AGAIN
              </button>
            </div>
          )}

          {/* EMPTY */}
          {!loading && !error && orders.length === 0 && (
            <div className="flex min-h-[50vh] flex-col items-center justify-center text-center">
              <p className="label-technical mb-4">
                NO ORDERS YET
              </p>

              <h2 className="font-display text-3xl tracking-tight text-bone">
                Nothing here yet.
              </h2>

              <p className="mt-4 max-w-md text-sm leading-relaxed text-stone">
                Your completed purchases will appear here.
              </p>

              <Link
                href="/shop"
                className="mt-8 border border-line-strong px-8 py-4 text-xs font-medium tracking-[0.18em] text-bone transition-colors hover:border-bone"
              >
                START SHOPPING
              </Link>
            </div>
          )}

          {/* ORDERS */}
          {!loading && !error && orders.length > 0 && (
            <div className="flex flex-col gap-8">
              {orders.map((order) => (
                <article
                  key={order.id}
                  className="border border-line bg-charcoal"
                >
                  {/* ORDER HEADER */}
                  <div className="border-b border-line px-5 py-5 sm:px-7">
                    <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">

                      <div className="grid grid-cols-2 gap-x-8 gap-y-3 sm:flex sm:items-center sm:gap-10">
                        <div>
                          <p className="label-technical text-stone">
                            ORDER
                          </p>

                          <p className="mt-1 font-mono text-sm text-bone">
                            {order.id}
                          </p>
                        </div>

                        <div>
                          <p className="label-technical text-stone">
                            DATE
                          </p>

                          <p className="mt-1 text-sm text-bone">
                            {formatDate(order.createdAt)}
                          </p>
                        </div>

                        <div>
                          <p className="label-technical text-stone">
                            STATUS
                          </p>

                          <p
                            className={`mt-1 text-xs font-medium tracking-[0.12em] ${statusClass(
                              order.status
                            )}`}
                          >
                            {statusLabel(order.status)}
                          </p>
                        </div>
                      </div>

                      <div className="text-left sm:text-right">
                        <p className="label-technical text-stone">
                          TOTAL
                        </p>

                        <p className="mt-1 font-mono text-sm text-bone">
                          {formatPrice(order.total)}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* PRODUCTS */}
                  <div className="px-5 sm:px-7">
                    <div className="divide-y divide-line">
                      {order.lines.map((line) => {
                        const imageKey = `${order.id}-${line.lineId}`;

                        return (
                          <div
                            key={line.lineId}
                            className="flex gap-4 py-5 sm:gap-6"
                          >
                            {/* IMAGE */}
                            <Link
                              href={`/product/${line.slug}`}
                              className="relative h-28 w-20 shrink-0 overflow-hidden bg-void sm:h-36 sm:w-28"
                            >
                              {line.image &&
                              !failedImages.has(imageKey) ? (
                                <Image
                                  src={line.image}
                                  alt={line.productName}
                                  fill
                                  sizes="112px"
                                  className="object-cover"
                                  onError={() => {
                                    setFailedImages(
                                      (previous) => {
                                        const next =
                                          new Set(previous);

                                        next.add(imageKey);

                                        return next;
                                      }
                                    );
                                  }}
                                />
                              ) : (
                                <ProductPlaceholderArt
                                  seed={line.productId}
                                  className="h-full w-full"
                                />
                              )}
                            </Link>

                            {/* DETAILS */}
                            <div className="flex min-w-0 flex-1 flex-col justify-between gap-4 sm:flex-row sm:items-center">
                              <div>
                                <Link
                                  href={`/product/${line.slug}`}
                                  className="text-sm font-medium text-bone transition-colors hover:text-mango"
                                >
                                  {line.productName}
                                </Link>

                                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-stone">
                                  <span>
                                    COLOR — {line.color}
                                  </span>

                                  <span>
                                    SIZE — {line.size}
                                  </span>

                                  <span>
                                    QTY — {line.quantity}
                                  </span>
                                </div>
                              </div>

                              <p className="shrink-0 font-mono text-sm text-bone">
                                {formatPrice(
                                  line.price * line.quantity
                                )}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* FOOTER */}
                  <div className="flex flex-col gap-4 border-t border-line px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-7">
                    <div className="text-xs text-stone">
                      {order.lines.length}{" "}
                      {order.lines.length === 1
                        ? "ITEM"
                        : "ITEMS"}
                    </div>

                    <Link
                      href={`/orders/${order.id}`}
                      className="border border-line-strong px-6 py-3 text-center text-xs font-medium tracking-[0.15em] text-bone transition-colors hover:border-bone"
                    >
                      VIEW ORDER
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </main>
    </>
  );
}