"use client";

import { useEffect, useState } from "react";
import type { Order } from "@/app/lib/dataStore";
import { formatPrice } from "@/app/data/productTypes";

const STATUS_OPTIONS: Order["status"][] = [
  "pending",
  "fulfilled",
  "cancelled",
];

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const load = async () => {
    setIsLoading(true);

    try {
      const res = await fetch("/api/admin/orders", {
        method: "GET",
        credentials: "include",
        cache: "no-store",
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(data?.error || "Failed to load orders.");
      }

      setOrders(Array.isArray(data) ? data : []);
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Something went wrong."
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();

    // If arriving with a #MG-XXXX hash from the dashboard,
    // expand that order automatically.
    const hash = window.location.hash.replace("#", "");

    if (hash) {
      setExpandedId(hash);
    }
  }, []);

  const handleStatusChange = async (
    id: string,
    status: Order["status"]
  ) => {
    setUpdatingId(id);

    try {
      const res = await fetch(`/api/admin/orders/${id}`, {
        method: "PATCH",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(
          data?.error || "Failed to update order."
        );
      }

      setOrders(Array.isArray(data?.orders) ? data.orders : orders);
    } catch (err) {
      alert(
        err instanceof Error
          ? err.message
          : "Failed to update order."
      );
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div>
      <p className="label-technical mb-2">SALES</p>

      <h1 className="mb-10 font-display text-2xl tracking-tight text-bone sm:text-3xl">
        Orders
      </h1>

      {/* LOADING */}
      {isLoading && (
        <p className="text-sm text-stone">
          Loading…
        </p>
      )}

      {/* ERROR */}
      {error && (
        <p className="text-sm text-mango">
          {error}
        </p>
      )}

      {/* EMPTY */}
      {!isLoading &&
        !error &&
        orders.length === 0 && (
          <div className="border border-line px-6 py-16 text-center">
            <p className="text-sm text-stone">
              No orders yet. Orders placed through the
              storefront checkout will show up here.
            </p>
          </div>
        )}

      {/* ORDERS */}
      {!isLoading &&
        !error &&
        orders.length > 0 && (
          <div className="flex flex-col gap-3">
            {orders.map((order) => {
              const isExpanded =
                expandedId === order.id;

              const discount =
                Number(order.discount) || 0;

              return (
                <div
                  key={order.id}
                  id={order.id}
                  className="border border-line"
                >
                  {/* ORDER HEADER */}
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedId(
                        isExpanded ? null : order.id
                      )
                    }
                    className="flex w-full items-start justify-between gap-4 px-4 py-4 text-left sm:items-center sm:px-5"
                    aria-expanded={isExpanded}
                  >
                    <div className="min-w-0">
                      <p className="break-all text-sm text-bone">
                        {order.id}
                      </p>

                      <p className="mt-0.5 break-words text-xs leading-relaxed text-stone [overflow-wrap:anywhere]">
                        {order.customer.firstName}{" "}
                        {order.customer.lastName} ·{" "}
                        {order.customer.email} ·{" "}
                        {new Date(
                          order.createdAt
                        ).toLocaleString()}
                      </p>
                    </div>

                    <div className="flex shrink-0 items-center gap-3 sm:gap-4">
                      <span className="font-mono text-sm text-bone-dim">
                        {formatPrice(order.total)}
                      </span>

                      <span className="text-stone">
                        {isExpanded ? "−" : "+"}
                      </span>
                    </div>
                  </button>

                  {/* EXPANDED ORDER */}
                  {isExpanded && (
                    <div className="border-t border-line px-4 py-5 sm:px-5">
                      {/* ADDRESS */}
                      <div className="mb-5 flex flex-col gap-1 text-xs text-stone">
                        <p>
                          {order.customer.address},{" "}
                          {order.customer.city}{" "}
                          {order.customer.postalCode}
                        </p>
                      </div>

                      {/* PRODUCTS */}
                      <ul className="mb-5 flex flex-col gap-3">
                        {order.lines.map((line) => (
                          <li
                            key={line.lineId}
                            className="flex items-start justify-between gap-4 text-sm"
                          >
                            <span className="text-bone-dim">
                              {line.productName}{" "}
                              <span className="text-stone">
                                — {line.color} /{" "}
                                {line.size} ×{" "}
                                {line.quantity}
                              </span>
                            </span>

                            <span className="shrink-0 font-mono text-stone">
                              {formatPrice(
                                line.price *
                                  line.quantity
                              )}
                            </span>
                          </li>
                        ))}
                      </ul>

                      {/* ORDER TOTALS */}
                      <div className="mb-5 flex flex-col gap-1.5 border-t border-line pt-4 font-mono text-xs">
                        {/* SUBTOTAL */}
                        <div className="flex justify-between text-stone">
                          <span>Subtotal</span>

                          <span>
                            {formatPrice(
                              order.subtotal
                            )}
                          </span>
                        </div>

                        {/* COUPON / DISCOUNT */}
                        {discount > 0 && (
                          <div className="flex justify-between text-stone">
                            <span>
                              Discount
                              {order.couponCode
                                ? ` (${order.couponCode})`
                                : ""}
                            </span>

                            <span>
                              -
                              {formatPrice(
                                discount
                              )}
                            </span>
                          </div>
                        )}

                        {/* SHIPPING */}
                        <div className="flex justify-between text-stone">
                          <span>Shipping</span>

                          <span>
                            {formatPrice(
                              order.shipping
                            )}
                          </span>
                        </div>

                        {/* TOTAL */}
                        <div className="flex justify-between border-t border-line pt-2 text-sm text-bone">
                          <span>Total</span>

                          <span>
                            {formatPrice(
                              order.total
                            )}
                          </span>
                        </div>
                      </div>

                      {/* STATUS */}
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="label-technical">
                          STATUS
                        </span>

                        <div className="flex flex-wrap gap-1.5">
                          {STATUS_OPTIONS.map(
                            (status) => (
                              <button
                                key={status}
                                type="button"
                                disabled={
                                  updatingId ===
                                  order.id
                                }
                                onClick={() =>
                                  handleStatusChange(
                                    order.id,
                                    status
                                  )
                                }
                                className={`px-3 py-2 text-xs uppercase tracking-wide transition-colors disabled:opacity-50 ${
                                  order.status ===
                                  status
                                    ? "bg-bone text-void"
                                    : "border border-line-strong text-stone hover:border-bone hover:text-bone"
                                }`}
                              >
                                {status}
                              </button>
                            )
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
    </div>
  );
}