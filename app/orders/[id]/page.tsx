"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useParams } from "next/navigation";

import Navigation from "@/app/components/Navigation";
import ProductPlaceholderArt from "@/app/components/ProductPlaceholderArt";
import { formatPrice } from "@/app/data/productTypes";
import {
  lineBadgeText,
  lineReturnBadges,
  orderStatusStyle,
  type OrderReturnRequest,
} from "@/app/orders/orderStatus";
import OrderTracking from "./OrderTracking";
import OrderReturns from "./OrderReturns";
import OrderReviews from "./OrderReviews";
import OrderActions from "./OrderActions";

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
  status: "pending" | "shipped" | "delivered" | "cancelled";
  shipment?: {
    courier: string;
    trackingNumber: string;
    trackingUrl: string;
    shippedAt: string;
  };
  deliveredAt?: string;
  cancelledAt?: string;
  cancelledBy?: "customer" | "admin";
  cancelReason?: string;
  paymentMethod?: string;
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
  discount?: number;
  couponCode?: string;
  total: number;
};

export default function OrderDetailsPage() {
 const params = useParams();

const orderId =
  typeof params.id === "string"
    ? params.id
    : Array.isArray(params.id)
      ? params.id[0]
      : "";

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [failedImages, setFailedImages] = useState<Set<string>>(
    new Set()
  );

  // Filled in by <OrderReturns> (it already loads this order's requests).
  const [returnRequests, setReturnRequests] = useState<OrderReturnRequest[]>([]);

useEffect(() => {
  if (!orderId) return;

  let cancelled = false;

  async function loadOrder() {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(
        `/api/orders/${encodeURIComponent(orderId)}`,
        {
          method: "GET",
          cache: "no-store",
        }
      );

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          data?.error || "Unable to load this order."
        );
      }

      if (!cancelled) {
        setOrder(data?.order ?? null);
      }
    } catch (err) {
      if (!cancelled) {
        setError(
          err instanceof Error
            ? err.message
            : "Unable to load this order."
        );
      }
    } finally {
      if (!cancelled) {
        setLoading(false);
      }
    }
  }

  loadOrder();

  return () => {
    cancelled = true;
  };
}, [orderId]);

  const formatDate = (date: string) => {
    return new Intl.DateTimeFormat("en-IN", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    }).format(new Date(date));
  };

  const formatTime = (date: string) => {
    return new Intl.DateTimeFormat("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(date));
  };

  // DELIVERED, or the return / exchange step when the whole order was
  // returned or exchanged (e.g. REFUND COMPLETED).
  const statusLabel = (current: Order) =>
    orderStatusStyle(current, returnRequests).label;

  const statusClass = (current: Order) =>
    orderStatusStyle(current, returnRequests).className;

  const handleDownloadSummary = () => {
    window.print();
  };

  return (
    <>
      <style jsx global>{`
        @media print {
          body {
            background: #fff !important;
          }

          body * {
            visibility: hidden;
          }

          .order-print-area,
          .order-print-area * {
            visibility: visible;
          }

          .order-print-area {
            position: absolute;
            inset: 0;
            width: 100%;
            padding: 32px !important;
            background: #fff !important;
            color: #111 !important;
          }

          .order-print-area .print-hidden {
            display: none !important;
          }

          .order-print-area section,
          .order-print-area aside {
            background: #fff !important;
            border-color: #ddd !important;
            color: #111 !important;
          }

          .order-print-area .text-bone,
          .order-print-area .text-stone,
          .order-print-area .text-orange-400,
          .order-print-area .text-red-500,
          .order-print-area .text-blue-400 {
            color: #111 !important;
          }
        }
      `}</style>
      <Navigation />

      <main className="order-print-area min-h-screen bg-void px-6 pb-20 pt-28 sm:px-10 lg:px-12">
        <div className="mx-auto max-w-6xl">

          {/* BACK */}
          <Link
            href="/orders"
            className="print-hidden label-technical inline-flex items-center gap-2 text-stone transition-colors hover:text-bone"
          >
            <span>←</span>
            <span>YOUR ORDERS</span>
          </Link>

          {/* LOADING */}
          {loading && (
            <div className="flex min-h-[60vh] items-center justify-center">
              <p className="label-technical animate-pulse text-stone">
                LOADING ORDER…
              </p>
            </div>
          )}

          {/* ERROR */}
          {!loading && error && (
            <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
              <p className="label-technical mb-4 text-mango">
                ORDER NOT FOUND
              </p>

              <p className="max-w-md text-sm leading-relaxed text-stone">
                {error}
              </p>

              <Link
                href="/orders"
                className="mt-8 border border-line-strong px-8 py-4 text-xs font-medium tracking-[0.16em] text-bone transition-colors hover:border-bone"
              >
                BACK TO ORDERS
              </Link>
            </div>
          )}

          {/* ORDER */}
          {!loading && !error && order && (
            <div className="mt-8">

              {/* HEADER */}
              <div className="border-b border-line pb-8">
                <p className="label-technical mb-3">
                  MANGOSTA / ORDER
                </p>

                <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    {/* Order number: kept small so it fits on one line on phones */}
                    <h1 className="font-display text-[22px] leading-tight tracking-tight text-bone [overflow-wrap:anywhere] sm:text-3xl">
                      {order.id}
                    </h1>

                    <p className="mt-3 text-sm text-stone">
                      Placed on {formatDate(order.createdAt)} at{" "}
                      {formatTime(order.createdAt)}
                    </p>
                  </div>

                  <div className="sm:text-right">
                    <p className="label-technical text-stone">
                      STATUS
                    </p>

                    <p
                      className={`mt-2 text-xs font-medium tracking-[0.16em] ${statusClass(
                        order
                      )}`}
                    >
                      {statusLabel(order)}
                    </p>
                  </div>
                </div>
              </div>

              <OrderTracking order={order} />

              <div className="mt-10 grid grid-cols-1 gap-10 lg:grid-cols-[1fr_360px]">

                {/* LEFT */}
                <div>

                  {/* ITEMS */}
                  <section className="border border-line bg-charcoal">
                    <div className="border-b border-line px-5 py-5 sm:px-7">
                      <p className="label-technical">
                        ORDER ITEMS
                      </p>
                    </div>

                    <div className="divide-y divide-line px-5 sm:px-7">
                      {order.lines.map((line) => {
                        const imageKey = `${order.id}-${line.lineId}`;

                        return (
                          <div
                            key={line.lineId}
                            className="flex gap-5 py-6 sm:gap-7"
                          >
                            {/* IMAGE */}
                            <Link
                              href={`/product/${line.slug}`}
                              className="relative h-32 w-24 shrink-0 overflow-hidden bg-void sm:h-40 sm:w-32"
                            >
                              {line.image &&
                              !failedImages.has(imageKey) ? (
                                <Image
                                  src={line.image}
                                  alt={line.productName}
                                  fill
                                  sizes="128px"
                                  className="object-cover"
                                  onError={() => {
                                    setFailedImages((previous) => {
                                      const next = new Set(previous);
                                      next.add(imageKey);
                                      return next;
                                    });
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
                            <div className="flex min-w-0 flex-1 flex-col justify-between">
                              <div>
                                <Link
                                  href={`/product/${line.slug}`}
                                  className="text-sm font-medium text-bone transition-colors hover:text-mango"
                                >
                                  {line.productName}
                                </Link>

                                <div className="mt-3 flex flex-col gap-1 text-xs text-stone">
                                  <span>
                                    COLOR — {line.color}
                                  </span>

                                  <span>
                                    SIZE — {line.size}
                                  </span>

                                  <span>
                                    QUANTITY — {line.quantity}
                                  </span>
                                </div>

                                {/* Return / exchange step for this product only */}
                                {lineReturnBadges(order, line, returnRequests).map((badge) => (
                                  <p
                                    key={badge.key}
                                    className={`mt-3 font-mono text-[10px] font-medium tracking-[0.12em] ${badge.className}`}
                                  >
                                    {lineBadgeText(badge)}
                                  </p>
                                ))}
                              </div>

                              <div className="mt-4 flex items-center justify-between gap-4">
                                <span className="label-technical text-stone">
                                  {formatPrice(line.price)} / ITEM
                                </span>

                                <span className="font-mono text-sm text-bone">
                                  {formatPrice(
                                    line.price * line.quantity
                                  )}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </section>

                  <OrderReviews order={order} />

                  {/* SHIPPING */}
                  <section className="mt-8 border border-line bg-charcoal">
                    <div className="border-b border-line px-5 py-5 sm:px-7">
                      <p className="label-technical">
                        SHIPPING ADDRESS
                      </p>
                    </div>

                    <div className="px-5 py-6 sm:px-7">
                      <p className="text-sm text-bone">
                        {order.customer.firstName}{" "}
                        {order.customer.lastName}
                      </p>

                      <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-stone">
                        {order.customer.address}
                        {"\n"}
                        {order.customer.city},{" "}
                        {order.customer.postalCode}
                      </p>

                      <p className="mt-4 text-xs text-stone">
                        {order.customer.email}
                      </p>
                    </div>
                  </section>

                  <OrderReturns
                    order={order}
                    onRequestsChange={setReturnRequests}
                  />
                </div>

                {/* RIGHT / SUMMARY */}
                <aside className="h-fit border border-line bg-charcoal lg:sticky lg:top-24">
                  <div className="border-b border-line px-6 py-5">
                    <p className="label-technical">
                      ORDER SUMMARY
                    </p>
                  </div>

                  <div className="px-6 py-6">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="label-technical text-stone">
                          SUBTOTAL
                        </span>

                        <span className="font-mono text-sm text-bone">
                          {formatPrice(order.subtotal)}
                        </span>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="label-technical text-stone">
                          SHIPPING
                        </span>

                        <span className="font-mono text-sm text-bone">
                          {formatPrice(order.shipping)}
                        </span>
                      </div>

                      {order.couponCode && (order.discount ?? 0) > 0 && (
                        <>
                          <div className="flex items-center justify-between gap-4">
                            <span className="label-technical text-stone">
                              COUPON — {order.couponCode}
                            </span>

                            <span className="font-mono text-sm text-orange-400">
                              -{formatPrice(order.discount ?? 0)}
                            </span>
                          </div>

                          <div className="flex items-center justify-between">
                            <span className="text-xs text-stone">
                              DISCOUNT APPLIED
                            </span>

                            <span className="text-xs font-medium text-orange-400">
                              {formatPrice(order.discount ?? 0)} OFF
                            </span>
                          </div>
                        </>
                      )}
                    </div>

                    <div className="my-6 border-t border-line" />

                    <div className="flex items-center justify-between">
                      <span className="label-technical">
                        TOTAL
                      </span>

                      <span className="font-mono text-lg text-bone">
                        {formatPrice(order.total)}
                      </span>
                    </div>

                    <div className="mt-7 space-y-3 print-hidden">
                      <button
                        type="button"
                        onClick={handleDownloadSummary}
                        className="block w-full border border-bone bg-bone py-3.5 text-center text-xs font-medium tracking-[0.16em] text-void transition-opacity hover:opacity-80"
                      >
                        DOWNLOAD ORDER SUMMARY
                      </button>

                      <Link
                        href="/orders"
                        className="block w-full border border-line-strong py-3.5 text-center text-xs font-medium tracking-[0.16em] text-bone transition-colors hover:border-bone"
                      >
                        BACK TO ORDERS
                      </Link>
                    </div>

                    <OrderActions order={order} onOrderChange={setOrder} />
                  </div>
                </aside>
              </div>
            </div>
          )}
        </div>
      </main>
    </>
  );
}