"use client";

import Link from "next/link";

type TrackableOrder = {
  id?: string;
  createdAt: string;
  status: "pending" | "shipped" | "delivered" | "cancelled";
  shipment?: { courier: string; trackingNumber: string; trackingUrl: string; shippedAt: string };
  deliveredAt?: string;
  cancelledAt?: string;
  cancelledBy?: "customer" | "admin";
  cancelReason?: string;
};

function formatDate(value?: string): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" }).format(date);
}

export default function OrderTracking({ order }: { order: TrackableOrder }) {
  if (order.status === "cancelled") {
    return (
      <div className="mt-8 border border-red-500/30 bg-red-500/5 px-5 py-4 text-sm text-bone-dim">
        {order.cancelledBy === "customer" ? "You cancelled this order" : "This order was cancelled"}
        {order.cancelledAt ? ` on ${formatDate(order.cancelledAt)}` : ""}.
        {order.cancelReason && (
          <span className="mt-1 block text-xs text-stone">Reason: {order.cancelReason}</span>
        )}
        <Link href="/support" className="mt-4 inline-block text-xs text-mango underline underline-offset-4">
          Need help with this order?
        </Link>
      </div>
    );
  }

  const stage = order.status === "delivered" ? 5 : order.status === "shipped" ? 3 : 0;
  const steps = [
    { key: "placed", label: "ORDER PLACED" },
    { key: "confirmed", label: "CONFIRMED" },
    { key: "packed", label: "PACKED" },
    { key: "shipped", label: "SHIPPED" },
    { key: "out", label: "OUT FOR DELIVERY" },
    { key: "delivered", label: "DELIVERED" },
  ];

  return (
    <section className="mt-8 border border-line bg-charcoal px-5 py-6 sm:px-7" aria-label="Order progress">
      <div className="overflow-x-auto pb-2">
        <ol className="flex min-w-[680px] items-start">
          {steps.map((step, index) => {
            const done = index <= stage;
            return (
              <li key={step.key} className="flex flex-1 items-start">
                <div className="w-full">
                  <div className="flex items-center">
                    <span
                      className={`relative z-10 h-3 w-3 shrink-0 rounded-full border-2 ${done ? "border-mango bg-mango" : "border-line-strong bg-void"}`}
                    />
                    {index < steps.length - 1 && (
                      <span className={`h-px flex-1 ${index < stage ? "bg-mango" : "bg-line-strong"}`} />
                    )}
                  </div>
                  <p
                    className={`mt-3 pr-3 font-mono text-[9px] tracking-[0.12em] ${done ? "text-bone" : "text-stone-dark"}`}
                  >
                    {step.label}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      </div>
      {order.status === "shipped" && (
        <p className="mt-4 text-xs text-stone">
          Your package has left Mangosta. The carrier&apos;s live tracking is the most accurate source for the
          next scan.
        </p>
      )}
      {order.status === "delivered" && order.deliveredAt && (
        <p className="mt-4 text-xs text-stone">Delivered on {formatDate(order.deliveredAt)}.</p>
      )}
      {order.shipment && (order.shipment.courier || order.shipment.trackingNumber) && (
        <div className="mt-6 flex flex-col gap-3 border-t border-line pt-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm">
            <p className="label-technical mb-1">SHIPMENT</p>
            <p className="text-bone">
              {order.shipment.courier || "Courier"}
              {order.shipment.trackingNumber && (
                <span className="font-mono text-bone-dim"> · {order.shipment.trackingNumber}</span>
              )}
            </p>
          </div>
          {order.shipment.trackingUrl && (
            <a
              href={order.shipment.trackingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="print-hidden border border-mango/50 px-6 py-3 text-center text-xs font-medium tracking-[0.15em] text-mango hover:border-mango"
            >
              TRACK PACKAGE ↗
            </a>
          )}
        </div>
      )}
      {order.id && (
        <div className="mt-5 border-t border-line pt-4">
          <Link
            href={`/support?order=${encodeURIComponent(order.id)}`}
            className="text-xs text-stone underline underline-offset-4 hover:text-bone"
          >
            Need help with this order?
          </Link>
        </div>
      )}
    </section>
  );
}
