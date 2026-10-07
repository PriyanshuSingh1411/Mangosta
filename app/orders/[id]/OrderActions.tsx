"use client";

import { useState } from "react";
import { getProductSizes } from "@/app/data/productTypes";
import type { Product } from "@/app/data/productTypes";
import {
  CANCEL_REASONS,
  SUPPORT_WHATSAPP_DISPLAY,
  whatsappOrderLink,
} from "@/app/data/storeTypes";
import { maxAllowedForLine, useCartStore } from "@/app/store/useCartStore";
import { trackEngagement } from "@/app/lib/trackEngagement";

type ActionOrder = {
  id: string;
  status: "pending" | "shipped" | "delivered" | "cancelled";
  paymentMethod?: string;
  lines: {
    lineId: string;
    productId: string;
    productName: string;
    size: string;
    color: string;
    quantity: number;
  }[];
};

const secondaryButton =
  "block w-full border border-line-strong py-3.5 text-center text-xs font-medium tracking-[0.16em] text-bone transition-colors hover:border-bone disabled:opacity-50";

/**
 * Order page actions (sidebar): Buy again (delivered orders), Cancel order
 * (while Processing) and WhatsApp help. Hidden when printing.
 */
export default function OrderActions<T extends ActionOrder>({
  order,
  onOrderChange,
}: {
  order: T;
  onOrderChange: (order: T) => void;
}) {
  return (
    <div className="print-hidden">
      {order.status === "delivered" && <BuyAgain order={order} />}
      {order.status === "pending" && <CancelOrder order={order} onOrderChange={onOrderChange} />}
      <WhatsAppHelp orderId={order.id} />
    </div>
  );
}

function BuyAgain({ order }: { order: ActionOrder }) {
  const addToBag = useCartStore((state) => state.addToBag);
  const openBag = useCartStore((state) => state.openBag);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ added: number; notes: string[] } | null>(null);

  const buyAgain = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/products", { cache: "no-store" });
      if (!response.ok) throw new Error();
      const products: Product[] = await response.json();
      const byId = new Map(products.map((product) => [product.id, product]));

      let added = 0;
      const notes: string[] = [];

      for (const line of order.lines) {
        const product = byId.get(line.productId);
        const label = `${line.productName}${line.color || line.size ? ` (${[line.color, line.size].filter(Boolean).join(" / ")})` : ""}`;

        if (!product) {
          notes.push(`${label} is no longer available.`);
          continue;
        }

        const colorOk =
          product.colors.length === 0 || product.colors.some((option) => option.name === line.color);
        if (!colorOk || !getProductSizes(product).includes(line.size)) {
          notes.push(`${label} isn't sold in this colour / size any more.`);
          continue;
        }

        const lineId = `${product.id}-${line.size}-${line.color}`;
        const bag = useCartStore.getState().lines;
        const inBag = bag.find((item) => item.lineId === lineId)?.quantity ?? 0;
        const room = maxAllowedForLine(bag, product, line.size, line.color, lineId) - inBag;
        const quantity = Math.min(line.quantity, room);

        if (quantity <= 0) {
          notes.push(inBag > 0 ? `${label} is already in your bag (no more in stock).` : `${label} is sold out.`);
          continue;
        }

        addToBag(product, line.size, line.color, quantity);
        added += quantity;
        if (quantity < line.quantity) {
          notes.push(`Only ${quantity} of ${label} left — added ${quantity}.`);
        }
      }

      setMessage({ added, notes });
      if (added > 0) openBag();
    } catch {
      setMessage({ added: 0, notes: ["Couldn't load the products. Please try again."] });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-3">
      <button
        type="button"
        onClick={() => void buyAgain()}
        disabled={busy}
        className="block w-full border border-mango py-3.5 text-center text-xs font-medium tracking-[0.16em] text-mango transition-colors hover:bg-mango hover:text-void disabled:opacity-50"
      >
        {busy ? "ADDING…" : "BUY AGAIN"}
      </button>
      {message && (
        <div className="mt-3 text-xs leading-relaxed" aria-live="polite">
          {message.added > 0 && (
            <p className="text-mango">
              {message.added} item{message.added === 1 ? "" : "s"} added to your bag.
            </p>
          )}
          {message.notes.map((note) => (
            <p key={note} className="mt-1 text-stone">
              {note}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

function CancelOrder<T extends ActionOrder>({
  order,
  onOrderChange,
}: {
  order: T;
  onOrderChange: (order: T) => void;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cancel = async () => {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/orders/${encodeURIComponent(order.id)}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.order) throw new Error(data?.error || "Couldn't cancel this order.");
      onOrderChange({ ...order, ...data.order });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't cancel this order.");
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-3 block w-full py-2 text-center text-xs tracking-[0.12em] text-stone underline underline-offset-4 transition-colors hover:text-bone"
      >
        Cancel order
      </button>
    );
  }

  return (
    <div className="mt-3 border border-line-strong p-4" role="group" aria-label="Cancel order">
      <p className="text-sm text-bone">Cancel this order?</p>
      <p className="mt-1 text-xs leading-relaxed text-stone">
        It hasn&apos;t shipped yet, so you can cancel it now.
        {order.paymentMethod === "cod" ? " Nothing has been charged." : ""}
      </p>

      <label className="mt-4 flex flex-col gap-1.5">
        <span className="text-xs text-stone">Reason (optional)</span>
        <select
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          className="border border-line-strong bg-void px-3 py-2.5 text-sm text-bone focus:border-bone focus:outline-none"
        >
          <option value="">Choose a reason</option>
          {CANCEL_REASONS.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </label>

      {error && (
        <p role="alert" className="mt-3 text-xs text-mango">
          {error}
        </p>
      )}

      <div className="mt-4 flex flex-col gap-2">
        <button
          type="button"
          onClick={() => void cancel()}
          disabled={busy}
          className="w-full bg-red-500/90 py-3 text-xs font-medium tracking-[0.16em] text-white transition-colors hover:bg-red-500 disabled:opacity-50"
        >
          {busy ? "CANCELLING…" : "YES, CANCEL ORDER"}
        </button>
        <button type="button" onClick={() => setOpen(false)} disabled={busy} className={secondaryButton}>
          KEEP MY ORDER
        </button>
      </div>
    </div>
  );
}

function WhatsAppHelp({ orderId }: { orderId: string }) {
  return (
    <div className="mt-6 border-t border-line pt-5">
      <p className="label-technical text-stone">NEED HELP WITH THIS ORDER?</p>
      <a
        href={whatsappOrderLink(orderId)}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() =>
          void trackEngagement({
            event: "support_open",
            metadata: { source: "whatsapp_order_help", orderId },
          })
        }
        className="mt-3 flex w-full items-center justify-center gap-2 border border-line-strong py-3.5 text-xs font-medium tracking-[0.16em] text-bone transition-colors hover:border-bone"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 fill-none stroke-current" strokeWidth="1.6">
          <path d="M4 20l1.3-3.9A8 8 0 1 1 8 18.7L4 20z" strokeLinejoin="round" />
          <path d="M9 9.5c.3 1.6 1.9 3.3 3.6 3.9l1.2-1 1.7.8-.3 1.3c-3 .3-6.4-2.8-6.6-5.6l1.3-.4.9 1.6-1 .9" strokeLinejoin="round" />
        </svg>
        CHAT ON WHATSAPP
      </a>
      <p className="mt-2 text-center text-[11px] text-stone">{SUPPORT_WHATSAPP_DISPLAY} · order number included</p>
    </div>
  );
}
