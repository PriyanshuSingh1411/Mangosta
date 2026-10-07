"use client";

import { useEffect, useMemo, useState } from "react";
import type { Order, OrderStatus } from "@/app/lib/dataStore";
import { formatPrice } from "@/app/data/productTypes";

const STATUS_OPTIONS: OrderStatus[] = [
  "pending",
  "shipped",
  "delivered",
  "cancelled",
];

const STATUS_LABEL: Record<OrderStatus, string> = {
  pending: "Processing",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

const STATUS_PILL: Record<OrderStatus, string> = {
  pending: "text-mango border-mango/40",
  shipped: "text-bone border-bone/40",
  delivered: "text-bone-dim border-line-strong",
  cancelled: "text-stone-dark border-line",
};

type ShipmentDraft = {
  courier: string;
  trackingNumber: string;
  trackingUrl: string;
};

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Arriving with a #MG-XXXX hash from the dashboard expands that order.
  const [expandedId, setExpandedId] = useState<string | null>(() =>
    typeof window === "undefined"
      ? null
      : window.location.hash.replace("#", "") || null
  );
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<{ id: string; message: string } | null>(null);
  const [filter, setFilter] = useState<OrderStatus | "all">("all");
  const [query, setQuery] = useState("");
  // Courier form shown under an order (when marking it shipped / editing)
  const [shipmentFor, setShipmentFor] = useState<string | null>(null);
  const [draft, setDraft] = useState<ShipmentDraft>({ courier: "", trackingNumber: "", trackingUrl: "" });

  useEffect(() => {
    fetch("/api/admin/orders", {
      method: "GET",
      credentials: "include",
      cache: "no-store",
    })
      .then(async (res) => {
        const data = await res.json().catch(() => null);

        if (!res.ok) {
          throw new Error(data?.error || "Failed to load orders.");
        }

        setOrders(Array.isArray(data) ? data : []);
        setError(null);
      })
      .catch((err) => {
        setError(
          err instanceof Error ? err.message : "Something went wrong."
        );
      })
      .finally(() => setIsLoading(false));
  }, []);

  const updateOrder = async (
    id: string,
    status: OrderStatus,
    shipment?: ShipmentDraft
  ) => {
    setUpdatingId(id);
    setRowError(null);

    try {
      const res = await fetch(`/api/admin/orders/${id}`, {
        method: "PATCH",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status, shipment }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(
          data?.error || "Failed to update order."
        );
      }

      setOrders(Array.isArray(data?.orders) ? data.orders : orders);
      setShipmentFor(null);
    } catch (err) {
      setRowError({
        id,
        message:
          err instanceof Error
            ? err.message
            : "Failed to update order.",
      });
    } finally {
      setUpdatingId(null);
    }
  };

  const openShipmentForm = (order: Order) => {
    setDraft({
      courier: order.shipment?.courier ?? "",
      trackingNumber: order.shipment?.trackingNumber ?? "",
      trackingUrl: order.shipment?.trackingUrl ?? "",
    });
    setShipmentFor(order.id);
    setRowError(null);
  };

  const counts = useMemo(() => {
    const map: Record<OrderStatus | "all", number> = {
      all: orders.length,
      pending: 0,
      shipped: 0,
      delivered: 0,
      cancelled: 0,
    };
    for (const order of orders) map[order.status] += 1;
    return map;
  }, [orders]);

  const visibleOrders = useMemo(() => {
    const q = query.trim().toLowerCase();
    return orders.filter((order) => {
      if (filter !== "all" && order.status !== filter) return false;
      if (!q) return true;
      return [
        order.id,
        order.customer.email,
        order.customer.firstName,
        order.customer.lastName,
        order.customer.mobile,
        order.shipment?.trackingNumber ?? "",
      ]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [orders, filter, query]);

  const inputClass =
    "w-full border border-line-strong bg-transparent px-3 py-2.5 text-sm text-bone placeholder:text-stone-dark focus:border-bone focus:outline-none";

  return (
    <div>
      <p className="label-technical mb-2">SALES</p>

      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <h1 className="font-display text-2xl tracking-tight text-bone sm:text-3xl">
          Orders
        </h1>

        <a
          href="/api/admin/orders/export"
          download
          className="border border-line-strong px-4 py-2.5 text-xs tracking-[0.12em] text-bone transition-colors hover:border-bone"
        >
          DOWNLOAD ORDERS (EXCEL / CSV)
        </a>
      </div>

      {/* FILTERS */}
      {!isLoading && !error && orders.length > 0 && (
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-1.5">
            {(["all", ...STATUS_OPTIONS] as const).map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => setFilter(status)}
                aria-pressed={filter === status}
                className={`px-3 py-2 text-xs uppercase tracking-wide transition-colors ${
                  filter === status
                    ? "bg-bone text-void"
                    : "border border-line-strong text-stone hover:border-bone hover:text-bone"
                }`}
              >
                {status === "all" ? "All" : STATUS_LABEL[status]} ({counts[status]})
              </button>
            ))}
          </div>

          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search order, name, email, tracking…"
            aria-label="Search orders"
            className="w-full border border-line-strong bg-transparent px-3 py-2 text-sm text-bone placeholder:text-stone-dark focus:border-bone focus:outline-none sm:max-w-xs"
          />
        </div>
      )}

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

      {!isLoading && !error && orders.length > 0 && visibleOrders.length === 0 && (
        <p className="border border-line px-6 py-10 text-center text-sm text-stone">
          No orders match.
        </p>
      )}

      {/* ORDERS */}
      {!isLoading &&
        !error &&
        visibleOrders.length > 0 && (
          <div className="flex flex-col gap-3">
            {visibleOrders.map((order) => {
              const isExpanded =
                expandedId === order.id;

              const discount =
                Number(order.discount) || 0;

              const showShipmentForm = shipmentFor === order.id;

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
                      <span className={`hidden border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide sm:inline ${STATUS_PILL[order.status]}`}>
                        {STATUS_LABEL[order.status]}
                      </span>

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
                          {order.customer.state ? `${order.customer.state} ` : ""}
                          {order.customer.postalCode}
                        </p>
                        {order.customer.mobile && <p>Mobile: {order.customer.mobile}</p>}
                        <p>
                          Payment: {order.paymentMethod.toUpperCase()} · {order.paymentStatus}
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
                        <div className="flex justify-between text-stone">
                          <span>Subtotal</span>
                          <span>{formatPrice(order.subtotal)}</span>
                        </div>

                        {discount > 0 && (
                          <div className="flex justify-between text-stone">
                            <span>
                              Discount
                              {order.couponCode
                                ? ` (${order.couponCode})`
                                : ""}
                            </span>
                            <span>-{formatPrice(discount)}</span>
                          </div>
                        )}

                        <div className="flex justify-between text-stone">
                          <span>Shipping</span>
                          <span>{formatPrice(order.shipping)}</span>
                        </div>

                        <div className="flex justify-between border-t border-line pt-2 text-sm text-bone">
                          <span>Total</span>
                          <span>{formatPrice(order.total)}</span>
                        </div>
                      </div>

                      {/* SHIPMENT DETAILS */}
                      {order.shipment && !showShipmentForm && (order.status === "shipped" || order.status === "delivered") && (
                        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border border-line-strong px-4 py-3 text-xs">
                          <div className="text-stone">
                            <span className="text-bone">{order.shipment.courier || "Courier not set"}</span>
                            {order.shipment.trackingNumber && <> · <span className="font-mono">{order.shipment.trackingNumber}</span></>}
                            {order.shipment.trackingUrl && (
                              <>
                                {" · "}
                                <a href={order.shipment.trackingUrl} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-bone">
                                  tracking link
                                </a>
                              </>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => openShipmentForm(order)}
                            className="text-xs text-stone underline underline-offset-4 hover:text-bone"
                          >
                            Edit courier details
                          </button>
                        </div>
                      )}

                      {showShipmentForm && (
                        <form
                          onSubmit={(event) => {
                            event.preventDefault();
                            void updateOrder(
                              order.id,
                              order.status === "delivered" ? "delivered" : "shipped",
                              draft
                            );
                          }}
                          className="mb-5 flex flex-col gap-3 border border-line-strong bg-charcoal/40 p-4"
                        >
                          <p className="label-technical">COURIER &amp; TRACKING</p>
                          <div className="grid gap-3 sm:grid-cols-2">
                            <label className="flex flex-col gap-1.5">
                              <span className="text-xs text-stone">Courier</span>
                              <input
                                value={draft.courier}
                                onChange={(e) => setDraft({ ...draft, courier: e.target.value })}
                                placeholder="Delhivery, Blue Dart, DTDC…"
                                className={inputClass}
                              />
                            </label>
                            <label className="flex flex-col gap-1.5">
                              <span className="text-xs text-stone">Tracking number (AWB)</span>
                              <input
                                value={draft.trackingNumber}
                                onChange={(e) => setDraft({ ...draft, trackingNumber: e.target.value })}
                                className={inputClass}
                              />
                            </label>
                          </div>
                          <label className="flex flex-col gap-1.5">
                            <span className="text-xs text-stone">Tracking link (optional)</span>
                            <input
                              value={draft.trackingUrl}
                              onChange={(e) => setDraft({ ...draft, trackingUrl: e.target.value })}
                              placeholder="https://www.delhivery.com/track/package/…"
                              className={inputClass}
                            />
                          </label>
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="submit"
                              disabled={updatingId === order.id}
                              className="bg-bone px-5 py-2.5 text-xs font-medium tracking-[0.15em] text-void hover:bg-mango disabled:opacity-50"
                            >
                              {order.status === "pending" ? "MARK AS SHIPPED" : "SAVE COURIER DETAILS"}
                            </button>
                            <button
                              type="button"
                              onClick={() => setShipmentFor(null)}
                              className="border border-line-strong px-5 py-2.5 text-xs tracking-[0.15em] text-stone hover:border-bone hover:text-bone"
                            >
                              CANCEL
                            </button>
                          </div>
                        </form>
                      )}

                      {/* CANCELLATION */}
                      {order.status === "cancelled" && (order.cancelledBy || order.cancelReason) && (
                        <div className="mb-5 border border-line-strong px-4 py-3 text-xs text-stone">
                          <span className="text-bone">
                            Cancelled by {order.cancelledBy === "customer" ? "the customer" : "admin"}
                          </span>
                          {order.cancelledAt && <> · {new Date(order.cancelledAt).toLocaleString()}</>}
                          {order.cancelReason && <> · Reason: <span className="text-bone-dim">{order.cancelReason}</span></>}
                          {order.stockRestored && <> · stock put back</>}
                        </div>
                      )}

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
                                  updatingId === order.id ||
                                  (order.status === "cancelled" &&
                                    Boolean(order.stockRestored) &&
                                    status !== "cancelled")
                                }
                                title={
                                  order.status === "cancelled" && order.stockRestored && status !== "cancelled"
                                    ? "This order's stock was put back when it was cancelled, so it can't be reopened."
                                    : undefined
                                }
                                onClick={() => {
                                  if (status === order.status) return;
                                  if (status === "shipped") {
                                    openShipmentForm(order);
                                    return;
                                  }
                                  void updateOrder(order.id, status);
                                }}
                                className={`px-3 py-2 text-xs uppercase tracking-wide transition-colors disabled:opacity-50 ${
                                  order.status ===
                                  status
                                    ? "bg-bone text-void"
                                    : "border border-line-strong text-stone hover:border-bone hover:text-bone"
                                }`}
                              >
                                {STATUS_LABEL[status]}
                              </button>
                            )
                          )}
                        </div>
                      </div>

                      {rowError?.id === order.id && (
                        <p role="alert" className="mt-3 text-xs text-mango">{rowError.message}</p>
                      )}
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
