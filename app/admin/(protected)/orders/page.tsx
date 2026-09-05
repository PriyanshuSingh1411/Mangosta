"use client";

import { useEffect, useState } from "react";
import type { Order } from "@/app/lib/dataStore";
import { formatPrice } from "@/app/data/productTypes";

const STATUS_OPTIONS: Order["status"][] = ["pending", "fulfilled", "cancelled"];

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const load = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/admin/orders");
      if (!res.ok) throw new Error("Failed to load orders.");
      setOrders(await res.json());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
    // If arriving with a #MG-XXXX hash from the dashboard, expand that order.
    const hash = window.location.hash.replace("#", "");
    if (hash) setExpandedId(hash);
  }, []);

  const handleStatusChange = async (id: string, status: Order["status"]) => {
    setUpdatingId(id);
    try {
      const res = await fetch(`/api/admin/orders/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("Failed to update order.");
      const data = await res.json();
      setOrders(data.orders);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to update order.");
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <div>
      <p className="label-technical mb-2">SALES</p>
      <h1 className="mb-10 font-display text-3xl tracking-tight text-bone">Orders</h1>

      {isLoading && <p className="text-sm text-stone">Loading…</p>}
      {error && <p className="text-sm text-mango">{error}</p>}

      {!isLoading && !error && orders.length === 0 && (
        <div className="border border-line px-6 py-16 text-center">
          <p className="text-sm text-stone">
            No orders yet. Orders placed through the storefront checkout will show up here.
          </p>
        </div>
      )}

      {!isLoading && !error && orders.length > 0 && (
        <div className="flex flex-col gap-3">
          {orders.map((order) => {
            const isExpanded = expandedId === order.id;
            return (
              <div key={order.id} id={order.id} className="border border-line">
                <button
                  type="button"
                  onClick={() => setExpandedId(isExpanded ? null : order.id)}
                  className="flex w-full items-center justify-between px-5 py-4 text-left"
                  aria-expanded={isExpanded}
                >
                  <div>
                    <p className="text-sm text-bone">{order.id}</p>
                    <p className="mt-0.5 text-xs text-stone">
                      {order.customer.firstName} {order.customer.lastName} ·{" "}
                      {order.customer.email} ·{" "}
                      {new Date(order.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="font-mono text-sm text-bone-dim">
                      {formatPrice(order.total)}
                    </span>
                    <span className="text-stone">{isExpanded ? "−" : "+"}</span>
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t border-line px-5 py-5">
                    <div className="mb-5 flex flex-col gap-1 text-xs text-stone">
                      <p>
                        {order.customer.address}, {order.customer.city} {order.customer.postalCode}
                      </p>
                    </div>

                    <ul className="mb-5 flex flex-col gap-3">
                      {order.lines.map((line) => (
                        <li
                          key={line.lineId}
                          className="flex items-center justify-between text-sm"
                        >
                          <span className="text-bone-dim">
                            {line.productName}{" "}
                            <span className="text-stone">
                              — {line.color} / {line.size} × {line.quantity}
                            </span>
                          </span>
                          <span className="font-mono text-stone">
                            {formatPrice(line.price * line.quantity)}
                          </span>
                        </li>
                      ))}
                    </ul>

                    <div className="mb-5 flex flex-col gap-1.5 border-t border-line pt-4 font-mono text-xs">
                      <div className="flex justify-between text-stone">
                        <span>Subtotal</span>
                        <span>{formatPrice(order.subtotal)}</span>
                      </div>
                      <div className="flex justify-between text-stone">
                        <span>Shipping</span>
                        <span>{formatPrice(order.shipping)}</span>
                      </div>
                      <div className="flex justify-between text-sm text-bone">
                        <span>Total</span>
                        <span>{formatPrice(order.total)}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="label-technical">STATUS</span>
                      <div className="flex gap-1.5">
                        {STATUS_OPTIONS.map((status) => (
                          <button
                            key={status}
                            type="button"
                            disabled={updatingId === order.id}
                            onClick={() => handleStatusChange(order.id, status)}
                            className={`px-3 py-1.5 text-xs uppercase tracking-wide transition-colors disabled:opacity-50 ${
                              order.status === status
                                ? "bg-bone text-void"
                                : "border border-line-strong text-stone hover:border-bone hover:text-bone"
                            }`}
                          >
                            {status}
                          </button>
                        ))}
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
