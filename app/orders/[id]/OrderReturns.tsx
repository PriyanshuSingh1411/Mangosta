"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useProducts } from "@/app/lib/useProducts";
import { getProductSizes, isVariantAvailable } from "@/app/data/productTypes";
import {
  RETURN_STATUS_LABELS,
  returnDaysLeft,
} from "@/app/data/storeTypes";
import type {
  ReturnRequest,
  ReturnRequestType,
  ReturnsPolicy,
} from "@/app/data/storeTypes";

type ReturnableOrder = {
  id: string;
  createdAt: string;
  status: string;
  deliveredAt?: string;
  lines: {
    lineId: string;
    productId: string;
    productName: string;
    size: string;
    color: string;
    quantity: number;
  }[];
};

type Selection = Record<string, { quantity: number; exchangeSize: string; exchangeColor: string }>;

/** Return / exchange requests for one order (customer side). */
export default function OrderReturns({
  order,
  onRequestsChange,
}: {
  order: ReturnableOrder;
  /** Lets the order page show the return / exchange step in its STATUS. */
  onRequestsChange?: (requests: ReturnRequest[]) => void;
}) {
  const [policy, setPolicy] = useState<ReturnsPolicy | null>(null);
  const [requests, setRequests] = useState<ReturnRequest[]>([]);
  const [open, setOpen] = useState(false);

  const load = useCallback(() => {
    return fetch("/api/returns", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (!data) return;
        const forThisOrder: ReturnRequest[] = (
          Array.isArray(data.requests) ? data.requests : []
        ).filter((request: ReturnRequest) => request.orderId === order.id);
        setPolicy(data.policy);
        setRequests(forThisOrder);
        onRequestsChange?.(forThisOrder);
      })
      .catch(() => undefined); // the section simply stays hidden
  }, [order.id, onRequestsChange]);

  useEffect(() => {
    load();
  }, [load]);

  // Units per line already in an active / completed request.
  const used = useMemo(() => {
    const map = new Map<string, number>();
    for (const request of requests) {
      if (request.status === "rejected") continue;
      for (const item of request.items) {
        map.set(item.lineId, (map.get(item.lineId) ?? 0) + item.quantity);
      }
    }
    return map;
  }, [requests]);

  if (!policy) return null;

  const daysLeft = returnDaysLeft(order, policy);
  const returnable = order.lines.filter((line) => line.quantity - (used.get(line.lineId) ?? 0) > 0);
  const canRequest = daysLeft !== null && returnable.length > 0 && (policy.allowReturns || policy.allowExchanges);

  if (requests.length === 0 && !canRequest) return null;

  return (
    <section className="print-hidden mt-8 border border-line bg-charcoal">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-5 sm:px-7">
        <p className="label-technical">RETURNS &amp; EXCHANGES</p>
        {canRequest && (
          <p className="text-xs text-stone">
            {daysLeft} day{daysLeft === 1 ? "" : "s"} left to request
          </p>
        )}
      </div>

      <div className="px-5 py-6 sm:px-7">
        {requests.length > 0 && (
          <ul className="mb-6 flex flex-col gap-4">
            {requests.map((request) => (
              <li key={request.id} className="border border-line-strong p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm text-bone">
                    {request.type === "exchange" ? "Exchange" : "Return"}{" "}
                    <span className="font-mono text-xs text-stone">{request.id}</span>
                  </p>
                  <span
                    className={`font-mono text-[10px] tracking-[0.14em] ${
                      request.status === "rejected"
                        ? "text-red-500"
                        : request.status === "completed"
                          ? "text-orange-400"
                          : "text-mango"
                    }`}
                  >
                    {RETURN_STATUS_LABELS[request.status]}
                  </span>
                </div>
                <ul className="mt-2 text-xs text-stone">
                  {request.items.map((item) => (
                    <li key={item.lineId}>
                      {item.productName} — {[item.color, item.size].filter(Boolean).join(" / ")} × {item.quantity}
                      {request.type === "exchange" && (
                        <span className="text-bone-dim">
                          {" "}→ {[item.exchangeColor, item.exchangeSize].filter(Boolean).join(" / ")}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
                {request.adminNote && (
                  <p className="mt-3 border-t border-line pt-3 text-xs text-bone-dim">
                    <span className="text-stone">MANGOSTA:</span> {request.adminNote}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}

        {canRequest && !open && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="w-full border border-line-strong py-3.5 text-xs font-medium tracking-[0.16em] text-bone transition-colors hover:border-bone sm:w-auto sm:px-8"
          >
            REQUEST {policy.allowReturns && policy.allowExchanges ? "RETURN / EXCHANGE" : policy.allowExchanges ? "EXCHANGE" : "RETURN"}
          </button>
        )}

        {canRequest && open && (
          <ReturnForm
            orderId={order.id}
            policy={policy}
            lines={returnable.map((line) => ({
              ...line,
              available: line.quantity - (used.get(line.lineId) ?? 0),
            }))}
            onCancel={() => setOpen(false)}
            onDone={() => {
              setOpen(false);
              void load();
            }}
          />
        )}

        {policy.policyText && (
          <p className="mt-5 text-[11px] leading-relaxed text-stone">{policy.policyText}</p>
        )}
      </div>
    </section>
  );
}

function ReturnForm({
  orderId,
  policy,
  lines,
  onCancel,
  onDone,
}: {
  orderId: string;
  policy: ReturnsPolicy;
  lines: (ReturnableOrder["lines"][number] & { available: number })[];
  onCancel: () => void;
  onDone: () => void;
}) {
  const { products } = useProducts();
  const [type, setType] = useState<ReturnRequestType>(policy.allowReturns ? "return" : "exchange");
  const [selection, setSelection] = useState<Selection>({});
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleLine = (line: (typeof lines)[number]) => {
    setSelection((current) => {
      const next = { ...current };
      if (next[line.lineId]) delete next[line.lineId];
      else next[line.lineId] = { quantity: 1, exchangeSize: line.size, exchangeColor: line.color };
      return next;
    });
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    const items = Object.entries(selection).map(([lineId, value]) => ({ lineId, ...value }));
    if (items.length === 0) {
      setError("Select at least one item.");
      return;
    }
    if (!reason) {
      setError("Please choose a reason.");
      return;
    }
    if (type === "exchange") {
      const unchanged = items.find((item) => {
        const line = lines.find((candidate) => candidate.lineId === item.lineId);
        return line && line.size === item.exchangeSize && line.color === item.exchangeColor;
      });
      if (unchanged) {
        setError("For an exchange, choose a different size or colour.");
        return;
      }
    }

    setSaving(true);
    try {
      const response = await fetch("/api/returns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, type, reason, note, items }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || "Couldn't send your request.");
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't send your request.");
    } finally {
      setSaving(false);
    }
  };

  const select = "border border-line-strong bg-void px-2.5 py-2 text-xs text-bone focus:border-bone focus:outline-none";

  return (
    <form onSubmit={submit} className="flex flex-col gap-6">
      {policy.allowReturns && policy.allowExchanges && (
        <div className="inline-flex w-fit border border-line-strong" role="group" aria-label="Request type">
          {(["return", "exchange"] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setType(option)}
              aria-pressed={type === option}
              className={`px-5 py-2.5 text-[10px] font-medium uppercase tracking-[0.18em] ${
                type === option ? "bg-bone text-void" : "text-stone hover:text-bone"
              }`}
            >
              {option === "return" ? "Return (refund)" : "Exchange"}
            </button>
          ))}
        </div>
      )}

      <fieldset>
        <legend className="label-technical mb-3">WHICH ITEMS?</legend>
        <ul className="flex flex-col gap-3">
          {lines.map((line) => {
            const chosen = selection[line.lineId];
            const product = products.find((candidate) => candidate.id === line.productId);
            const sizes = product ? getProductSizes(product) : [line.size];
            const colors = product && product.colors.length > 0 ? product.colors.map((c) => c.name) : [line.color];

            return (
              <li key={line.lineId} className="border border-line-strong p-3">
                <label className="flex items-start gap-3 text-sm text-bone">
                  <input
                    type="checkbox"
                    checked={Boolean(chosen)}
                    onChange={() => toggleLine(line)}
                    className="mt-1 h-4 w-4 shrink-0 accent-[color:var(--color-mango)]"
                  />
                  <span>
                    {line.productName}
                    <span className="block text-xs text-stone">
                      {[line.color, line.size].filter(Boolean).join(" / ")} · bought {line.quantity}
                    </span>
                  </span>
                </label>

                {chosen && (
                  <div className="mt-3 flex flex-wrap items-center gap-3 pl-7 text-xs text-stone">
                    <label className="flex items-center gap-2">
                      Qty
                      <select
                        value={chosen.quantity}
                        onChange={(e) =>
                          setSelection((current) => ({
                            ...current,
                            [line.lineId]: { ...chosen, quantity: Number(e.target.value) },
                          }))
                        }
                        className={select}
                      >
                        {Array.from({ length: line.available }, (_, i) => i + 1).map((qty) => (
                          <option key={qty} value={qty}>{qty}</option>
                        ))}
                      </select>
                    </label>

                    {type === "exchange" && (
                      <>
                        {colors.length > 1 && (
                          <label className="flex items-center gap-2">
                            Colour
                            <select
                              value={chosen.exchangeColor}
                              onChange={(e) =>
                                setSelection((current) => ({
                                  ...current,
                                  [line.lineId]: { ...chosen, exchangeColor: e.target.value },
                                }))
                              }
                              className={select}
                            >
                              {colors.map((color) => (
                                <option key={color} value={color}>{color}</option>
                              ))}
                            </select>
                          </label>
                        )}
                        <label className="flex items-center gap-2">
                          New size
                          <select
                            value={chosen.exchangeSize}
                            onChange={(e) =>
                              setSelection((current) => ({
                                ...current,
                                [line.lineId]: { ...chosen, exchangeSize: e.target.value },
                              }))
                            }
                            className={select}
                          >
                            {sizes.map((size) => (
                              <option key={size} value={size}>
                                {size}
                                {product && !isVariantAvailable(product, chosen.exchangeColor, size) ? " (sold out)" : ""}
                              </option>
                            ))}
                          </select>
                        </label>
                      </>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </fieldset>

      <label className="flex flex-col gap-1.5">
        <span className="label-technical">REASON</span>
        <select value={reason} onChange={(e) => setReason(e.target.value)} className={`${select} py-3 text-sm`}>
          <option value="">Choose a reason</option>
          {policy.reasons.map((option) => (
            <option key={option} value={option}>{option}</option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="label-technical">ANYTHING ELSE? (OPTIONAL)</span>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          maxLength={1000}
          className="border border-line-strong bg-transparent px-3.5 py-2.5 text-sm text-bone focus:border-bone focus:outline-none"
        />
      </label>

      {error && <p role="alert" className="text-xs text-mango">{error}</p>}

      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          disabled={saving}
          className="bg-bone px-6 py-3.5 text-xs font-medium tracking-[0.16em] text-void transition-colors hover:bg-mango disabled:opacity-50"
        >
          {saving ? "SENDING…" : "SEND REQUEST"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="border border-line-strong px-6 py-3.5 text-xs tracking-[0.16em] text-bone-dim hover:border-bone hover:text-bone"
        >
          CANCEL
        </button>
      </div>
    </form>
  );
}
