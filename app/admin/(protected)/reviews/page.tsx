"use client";

import { useEffect, useMemo, useState } from "react";
import type { Review } from "@/app/data/storeTypes";
import type { Product } from "@/app/data/productTypes";

type Filter = "all" | "published" | "hidden";

export default function AdminReviewsPage() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [productFilter, setProductFilter] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/admin/reviews", { cache: "no-store" }).then((r) => r.json()),
      fetch("/api/admin/products", { cache: "no-store" }).then((r) => r.json()),
    ])
      .then(([reviewData, productData]) => {
        setReviews(Array.isArray(reviewData?.reviews) ? reviewData.reviews : []);
        setProducts(Array.isArray(productData) ? productData : []);
      })
      .catch(() => setError("Failed to load reviews."))
      .finally(() => setLoading(false));
  }, []);

  const productName = (id: string) => products.find((p) => p.id === id)?.name ?? id;

  const visible = useMemo(
    () =>
      reviews.filter(
        (review) =>
          (filter === "all" || review.status === filter) &&
          (!productFilter || review.productId === productFilter)
      ),
    [reviews, filter, productFilter]
  );

  const setStatus = async (review: Review, status: Review["status"]) => {
    setBusy(review.id);
    try {
      const response = await fetch(`/api/admin/reviews/${review.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!response.ok) throw new Error();
      setReviews((current) => current.map((item) => (item.id === review.id ? { ...item, status } : item)));
    } catch {
      setError("Couldn't update that review.");
    } finally {
      setBusy(null);
    }
  };

  const remove = async (review: Review) => {
    setBusy(review.id);
    try {
      const response = await fetch(`/api/admin/reviews/${review.id}`, { method: "DELETE" });
      if (!response.ok) throw new Error();
      setReviews((current) => current.filter((item) => item.id !== review.id));
    } catch {
      setError("Couldn't delete that review.");
    } finally {
      setBusy(null);
      setConfirmDelete(null);
    }
  };

  const reviewedProducts = [...new Set(reviews.map((review) => review.productId))];

  return (
    <div className="max-w-5xl">
      <p className="label-technical mb-2">CUSTOMERS</p>
      <h1 className="mb-3 font-display text-2xl tracking-tight text-bone sm:text-3xl">Reviews</h1>
      <p className="mb-8 max-w-2xl text-sm leading-relaxed text-stone">
        Only customers whose order with the product was delivered can review it, and reviews
        appear straight away. Hide a review to remove it from the shop without deleting it.
      </p>

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-1.5">
          {(["all", "published", "hidden"] as const).map((option) => (
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
              {option} ({option === "all" ? reviews.length : reviews.filter((r) => r.status === option).length})
            </button>
          ))}
        </div>
        {reviewedProducts.length > 1 && (
          <select
            value={productFilter}
            onChange={(e) => setProductFilter(e.target.value)}
            aria-label="Filter by product"
            className="border border-line-strong bg-void px-3 py-2 text-sm text-bone focus:border-bone focus:outline-none"
          >
            <option value="">All products</option>
            {reviewedProducts.map((id) => (
              <option key={id} value={id}>
                {productName(id)}
              </option>
            ))}
          </select>
        )}
      </div>

      {loading && <p className="text-sm text-stone">Loading…</p>}
      {error && <p className="mb-4 text-sm text-mango">{error}</p>}

      {!loading && visible.length === 0 && (
        <p className="border border-line px-6 py-12 text-center text-sm text-stone">
          {reviews.length === 0 ? "No reviews yet." : "No reviews match."}
        </p>
      )}

      <div className="flex flex-col gap-3">
        {visible.map((review) => (
          <article key={review.id} className={`border border-line p-4 sm:p-5 ${review.status === "hidden" ? "opacity-60" : ""}`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm text-bone">
                  <span className="text-mango">{"★".repeat(review.rating)}</span>
                  <span className="text-stone-dark">{"★".repeat(5 - review.rating)}</span>{" "}
                  {review.title && <span className="font-medium">{review.title}</span>}
                </p>
                <p className="mt-0.5 text-xs text-stone">
                  {productName(review.productId)} · {review.authorName}
                  {(review.color || review.size) && ` · ${[review.color, review.size].filter(Boolean).join(" / ")}`}
                  {" · "}
                  {new Date(review.createdAt).toLocaleDateString()}
                  {(review.helpful ?? 0) > 0 && ` · ${review.helpful} found it helpful`}
                </p>
              </div>
              <span className="border border-line-strong px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide text-bone-dim">
                {review.status}
              </span>
            </div>

            <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-bone-dim">{review.body}</p>

            {review.photos.length > 0 && (
              <div className="mt-3 flex gap-2">
                {review.photos.map((photo) => (
                  <a key={photo} href={photo} target="_blank" rel="noopener noreferrer" className="block h-16 w-16 border border-line-strong">
                    <span
                      aria-hidden="true"
                      className="block h-full w-full bg-void bg-cover bg-center"
                      style={{ backgroundImage: `url("${photo}")` }}
                    />
                  </a>
                ))}
              </div>
            )}

            <ReplyEditor
              review={review}
              onSaved={(reply) =>
                setReviews((current) =>
                  current.map((item) => (item.id === review.id ? { ...item, reply } : item))
                )
              }
            />

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busy === review.id}
                onClick={() => void setStatus(review, review.status === "published" ? "hidden" : "published")}
                className="border border-line-strong px-3 py-2 text-xs uppercase tracking-wide text-stone transition-colors hover:border-bone hover:text-bone disabled:opacity-50"
              >
                {review.status === "published" ? "Hide" : "Show again"}
              </button>
              {confirmDelete === review.id ? (
                <>
                  <button
                    type="button"
                    disabled={busy === review.id}
                    onClick={() => void remove(review)}
                    className="bg-mango px-3 py-2 text-xs uppercase tracking-wide text-void disabled:opacity-50"
                  >
                    Yes, delete
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(null)}
                    className="border border-line-strong px-3 py-2 text-xs uppercase tracking-wide text-stone hover:text-bone"
                  >
                    Keep
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(review.id)}
                  className="border border-line-strong px-3 py-2 text-xs uppercase tracking-wide text-stone transition-colors hover:border-mango hover:text-mango"
                >
                  Delete
                </button>
              )}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

/** Mangosta's public reply, shown under the review on the product page. */
function ReplyEditor({
  review,
  onSaved,
}: {
  review: Review;
  onSaved: (reply: Review["reply"]) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(review.reply?.text ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async (value: string) => {
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/reviews/${review.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reply: value }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || "Couldn't save the reply.");
      const clean = value.trim();
      onSaved(clean ? { text: clean, at: new Date().toISOString() } : undefined);
      setText(clean);
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save the reply.");
    } finally {
      setSaving(false);
    }
  };

  if (!editing) {
    return review.reply ? (
      <div className="mt-4 border-l-2 border-mango/60 bg-charcoal/40 px-4 py-3">
        <p className="label-technical text-mango">YOUR REPLY</p>
        <p className="mt-1.5 whitespace-pre-line text-sm text-bone-dim">{review.reply.text}</p>
        <div className="mt-2 flex gap-4 text-xs">
          <button type="button" onClick={() => setEditing(true)} className="text-stone underline underline-offset-4 hover:text-bone">
            Edit reply
          </button>
          <button type="button" disabled={saving} onClick={() => void save("")} className="text-stone underline underline-offset-4 hover:text-mango disabled:opacity-50">
            Remove reply
          </button>
        </div>
        {error && <p role="alert" className="mt-2 text-xs text-mango">{error}</p>}
      </div>
    ) : (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="mt-4 text-xs text-stone underline underline-offset-4 hover:text-bone"
      >
        Reply as Mangosta
      </button>
    );
  }

  return (
    <div className="mt-4 flex flex-col gap-2">
      <label className="flex flex-col gap-1.5">
        <span className="text-xs text-stone">Reply (shown under the review on the product page)</span>
        <textarea
          value={text}
          onChange={(event) => setText(event.target.value)}
          rows={3}
          maxLength={1000}
          placeholder="Thanks for the kind words! …"
          className="border border-line-strong bg-transparent px-3.5 py-2.5 text-sm text-bone focus:border-bone focus:outline-none"
        />
      </label>
      {error && <p role="alert" className="text-xs text-mango">{error}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          disabled={saving || !text.trim()}
          onClick={() => void save(text)}
          className="bg-bone px-4 py-2 text-xs uppercase tracking-wide text-void hover:bg-mango disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save reply"}
        </button>
        <button
          type="button"
          onClick={() => {
            setText(review.reply?.text ?? "");
            setEditing(false);
          }}
          className="border border-line-strong px-4 py-2 text-xs uppercase tracking-wide text-stone hover:text-bone"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
