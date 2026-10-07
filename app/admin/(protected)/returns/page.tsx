"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { RETURN_STATUS_LABELS } from "@/app/data/storeTypes";
import type {
  ReturnRequest,
  ReturnRequestStatus,
  ReturnsPolicy,
} from "@/app/data/storeTypes";
import { adminButtonClass, adminInputClass, useStoreConfig } from "../useStoreConfig";

const FILTERS: (ReturnRequestStatus | "open" | "all")[] = [
  "open",
  "requested",
  "approved",
  "received",
  "completed",
  "rejected",
  "all",
];

const OPEN: ReturnRequestStatus[] = ["requested", "approved", "received"];

export default function AdminReturnsPage() {
  const [requests, setRequests] = useState<ReturnRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("open");

  useEffect(() => {
    fetch("/api/admin/returns", { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json().catch(() => null);
        if (!response.ok) throw new Error(data?.error || "Failed to load requests.");
        setRequests(Array.isArray(data?.requests) ? data.requests : []);
        setError(null);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to load requests.");
      })
      .finally(() => setLoading(false));
  }, []);

  const visible = useMemo(
    () =>
      requests.filter((request) =>
        filter === "all" ? true : filter === "open" ? OPEN.includes(request.status) : request.status === filter
      ),
    [requests, filter]
  );

  const count = (value: (typeof FILTERS)[number]) =>
    value === "all"
      ? requests.length
      : value === "open"
        ? requests.filter((r) => OPEN.includes(r.status)).length
        : requests.filter((r) => r.status === value).length;

  return (
    <div className="max-w-5xl">
      <p className="label-technical mb-2">SALES</p>
      <h1 className="mb-8 font-display text-2xl tracking-tight text-bone sm:text-3xl">Returns &amp; Exchanges</h1>

      <div className="mb-6 flex flex-wrap gap-1.5">
        {FILTERS.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setFilter(option)}
            aria-pressed={filter === option}
            className={`px-3 py-2 text-xs uppercase tracking-wide transition-colors ${
              filter === option
                ? "bg-bone text-void"
                : "border border-line-strong text-stone hover:border-bone hover:text-bone"
            }`}
          >
            {option === "open" ? "Open" : option === "all" ? "All" : RETURN_STATUS_LABELS[option].toLowerCase()} ({count(option)})
          </button>
        ))}
      </div>

      {loading && <p className="text-sm text-stone">Loading…</p>}
      {error && <p className="text-sm text-mango">{error}</p>}

      {!loading && !error && visible.length === 0 && (
        <p className="border border-line px-6 py-12 text-center text-sm text-stone">
          {requests.length === 0
            ? "No return or exchange requests yet. Customers request them from Your Orders after delivery."
            : "Nothing here."}
        </p>
      )}

      <div className="flex flex-col gap-3">
        {visible.map((request) => (
          <ReturnCard
            key={request.id}
            request={request}
            onUpdated={(updated) =>
              setRequests((current) => current.map((item) => (item.id === updated.id ? updated : item)))
            }
          />
        ))}
      </div>

      <PolicySettings />
    </div>
  );
}

function ReturnCard({
  request,
  onUpdated,
}: {
  request: ReturnRequest;
  onUpdated: (request: ReturnRequest) => void;
}) {
  const [note, setNote] = useState(request.adminNote);
  const [restock, setRestock] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const act = async (status?: ReturnRequestStatus) => {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/admin/returns/${request.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, adminNote: note, restock: status === "received" && restock }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || "Failed to update.");
      onUpdated(data.request);
      setMessage(
        status === "received" && restock
          ? `Saved — items added back to stock${data.alertsSent ? ` (${data.alertsSent} back-in-stock email(s) sent)` : ""}.`
          : "Saved."
      );
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed to update.");
    } finally {
      setBusy(false);
    }
  };

  const isExchange = request.type === "exchange";
  const button = "px-3 py-2 text-xs uppercase tracking-wide transition-colors disabled:opacity-50";

  return (
    <article className="border border-line">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-4 py-4 sm:px-5">
        <div className="min-w-0">
          <p className="text-sm text-bone">
            {isExchange ? "Exchange" : "Return"} <span className="font-mono text-xs text-stone">{request.id}</span>
          </p>
          <p className="mt-0.5 text-xs text-stone [overflow-wrap:anywhere]">
            {request.customerName} · {request.customerEmail} · order{" "}
            <Link href={`/admin/orders#${request.orderId}`} className="underline underline-offset-2 hover:text-bone">
              {request.orderId}
            </Link>{" "}
            · {new Date(request.createdAt).toLocaleString()}
          </p>
        </div>
        <span className="border border-line-strong px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide text-bone-dim">
          {RETURN_STATUS_LABELS[request.status]}
          {request.restocked ? " · restocked" : ""}
        </span>
      </div>

      <div className="px-4 py-4 sm:px-5">
        <ul className="mb-3 flex flex-col gap-1.5 text-sm">
          {request.items.map((item) => (
            <li key={item.lineId} className="text-bone-dim">
              {item.productName}{" "}
              <span className="text-stone">
                — {[item.color, item.size].filter(Boolean).join(" / ")} × {item.quantity}
              </span>
              {isExchange && (
                <span className="text-mango">
                  {" "}→ wants {[item.exchangeColor, item.exchangeSize].filter(Boolean).join(" / ")}
                </span>
              )}
            </li>
          ))}
        </ul>
        <p className="text-xs text-stone">
          Reason: <span className="text-bone-dim">{request.reason}</span>
        </p>
        {request.note && (
          <p className="mt-1 whitespace-pre-line text-xs text-stone">
            Customer note: <span className="text-bone-dim">{request.note}</span>
          </p>
        )}

        <label className="mt-4 flex flex-col gap-1.5">
          <span className="text-xs text-stone">Note to customer (shown on their order page)</span>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            className={adminInputClass}
            placeholder="e.g. Pickup scheduled for Monday. Please pack the item with its tags."
          />
        </label>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {request.status === "requested" && (
            <>
              <button type="button" disabled={busy} onClick={() => void act("approved")} className={`${button} bg-bone text-void hover:bg-mango`}>
                Approve
              </button>
              <button type="button" disabled={busy} onClick={() => void act("rejected")} className={`${button} border border-line-strong text-stone hover:border-bone hover:text-bone`}>
                Reject
              </button>
            </>
          )}
          {request.status === "approved" && (
            <>
              <label className="mr-2 flex items-center gap-2 text-xs text-bone-dim">
                <input
                  type="checkbox"
                  checked={restock}
                  onChange={(e) => setRestock(e.target.checked)}
                  className="h-4 w-4 accent-[color:var(--color-mango)]"
                />
                Add items back to stock
              </label>
              <button type="button" disabled={busy} onClick={() => void act("received")} className={`${button} bg-bone text-void hover:bg-mango`}>
                Mark items received
              </button>
              <button type="button" disabled={busy} onClick={() => void act("rejected")} className={`${button} border border-line-strong text-stone hover:border-bone hover:text-bone`}>
                Reject
              </button>
            </>
          )}
          {request.status === "received" && (
            <button type="button" disabled={busy} onClick={() => void act("completed")} className={`${button} bg-bone text-void hover:bg-mango`}>
              {isExchange ? "Mark exchange sent" : "Mark refunded"}
            </button>
          )}
          <button
            type="button"
            disabled={busy || note === request.adminNote}
            onClick={() => void act()}
            className={`${button} border border-line-strong text-stone hover:border-bone hover:text-bone`}
          >
            Save note
          </button>
        </div>

        {message && <p className="mt-3 text-xs text-mango" aria-live="polite">{message}</p>}
      </div>
    </article>
  );
}

function PolicySettings() {
  const { value, update, save, loading, saving, error, saved } =
    useStoreConfig<ReturnsPolicy>("returnsPolicy");

  if (loading || !value) return null;

  return (
    <section className="mt-12 border border-line-strong bg-charcoal/30 p-5">
      <p className="label-technical mb-2">RETURN POLICY</p>
      <p className="mb-5 max-w-2xl text-sm leading-relaxed text-stone">This policy is shown in the <span className="text-bone-dim">Returns &amp; Exchanges</span> section on every product page and is also used when customers request a return or exchange.</p>

      <div className="flex flex-col gap-4">
        <label className="flex items-center gap-2 text-sm text-bone-dim">
          <input
            type="checkbox"
            checked={value.enabled}
            onChange={(e) => update({ enabled: e.target.checked })}
            className="h-4 w-4 accent-[color:var(--color-mango)]"
          />
          Customers can request returns / exchanges from Your Orders
        </label>

        <div className="flex flex-wrap items-center gap-x-6 gap-y-3 text-sm text-bone-dim">
          <label className="flex items-center gap-2">
            Within
            <input
              type="number"
              min={1}
              max={90}
              value={value.windowDays}
              onChange={(e) => update({ windowDays: Number(e.target.value) })}
              className="w-16 border border-line-strong bg-transparent px-2 py-1.5 text-center font-mono text-sm text-bone focus:border-bone focus:outline-none"
            />
            days of delivery
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={value.allowReturns}
              onChange={(e) => update({ allowReturns: e.target.checked })}
              className="h-4 w-4 accent-[color:var(--color-mango)]"
            />
            Returns (refund)
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={value.allowExchanges}
              onChange={(e) => update({ allowExchanges: e.target.checked })}
              className="h-4 w-4 accent-[color:var(--color-mango)]"
            />
            Exchanges (size / colour)
          </label>
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs text-stone">Reasons customers can pick (one per line)</span>
          <textarea
            value={value.reasons.join("\n")}
            onChange={(e) => update({ reasons: e.target.value.split("\n") })}
            rows={5}
            className={adminInputClass}
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs text-stone">Policy text (shown on every product page and under the request form)</span>
          <textarea
            value={value.policyText}
            onChange={(e) => update({ policyText: e.target.value })}
            rows={3}
            className={adminInputClass}
          />
        </label>

        {value.policyText && (
          <div className="border border-line bg-void/40 p-4">
            <p className="label-technical mb-2">STORE FRONT PREVIEW</p>
            <p className="text-sm leading-relaxed text-bone-dim">{value.policyText}</p>
          </div>
        )}

        {error && <p role="alert" className="text-sm text-mango">{error}</p>}

        <div className="flex items-center gap-4">
          <button type="button" onClick={() => void save()} disabled={saving} className={adminButtonClass}>
            {saving ? "SAVING…" : "SAVE POLICY"}
          </button>
          {saved && <span className="text-xs text-mango">Saved.</span>}
        </div>
      </div>
    </section>
  );
}
