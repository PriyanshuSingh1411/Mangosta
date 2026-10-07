"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/app/components/AuthProvider";
import StarRating from "@/app/components/StarRating";
import { EMPTY_REVIEW_SUMMARY, REVIEW_SORTS, sortReviews } from "@/app/data/storeTypes";
import type { PublicReview, ReviewSort, ReviewSummary } from "@/app/data/storeTypes";

type Eligibility =
  | { canReview: true; color: string; size: string }
  | { canReview: false; reason: "signed_out" | "not_purchased" | "already_reviewed" };

type ReviewsResponse = {
  reviews: PublicReview[];
  summary: ReviewSummary;
  eligibility: Eligibility;
};

const PAGE_SIZE = 6;

export default function ProductReviews({
  productId,
  productName,
}: {
  productId: string;
  productName: string;
}) {
  const { user, loading: authLoading, openAuth } = useAuth();
  const [data, setData] = useState<ReviewsResponse | null>(null);
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [writing, setWriting] = useState(false);
  const [zoomPhoto, setZoomPhoto] = useState<string | null>(null);
  const [sort, setSort] = useState<ReviewSort>("newest");
  const [voting, setVoting] = useState<string | null>(null);
  const [voteError, setVoteError] = useState<{ id: string; message: string } | null>(null);

  const load = useCallback(() => {
    return fetch(`/api/reviews?productId=${encodeURIComponent(productId)}`, {
      cache: "no-store",
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((next: ReviewsResponse | null) => {
        if (next) setData(next);
      })
      .catch(() => undefined); // keep whatever was shown
  }, [productId]);

  // Reload when the customer signs in/out (eligibility depends on it).
  const userId = user?.id;
  useEffect(() => {
    if (authLoading) return;
    load();
  }, [authLoading, userId, load]);

  const summary = data?.summary ?? EMPTY_REVIEW_SUMMARY;
  const reviews = useMemo(() => data?.reviews ?? [], [data]);
  const eligibility = data?.eligibility;
  const sorted = useMemo(() => sortReviews(reviews, sort), [reviews, sort]);

  // "Helpful" — signed-in customers, one vote each; tap again to undo.
  const vote = async (review: PublicReview) => {
    if (!user) {
      openAuth("signin");
      return;
    }
    setVoting(review.id);
    setVoteError(null);
    try {
      const response = await fetch(`/api/reviews/${encodeURIComponent(review.id)}/helpful`, {
        method: "POST",
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) throw new Error(result?.error || "Couldn't save your vote.");
      setData((current) =>
        current
          ? {
              ...current,
              reviews: current.reviews.map((item) =>
                item.id === review.id ? { ...item, helpful: result.helpful, voted: result.voted } : item
              ),
            }
          : current
      );
    } catch (err) {
      setVoteError({ id: review.id, message: err instanceof Error ? err.message : "Couldn't save your vote." });
    } finally {
      setVoting(null);
    }
  };

  return (
    <div id="reviews" className="scroll-mt-28">
      <div className="flex flex-col gap-10 lg:flex-row lg:gap-16">
        {/* Summary */}
        <div className="lg:w-80 lg:shrink-0">
          <p className="label-technical mb-4">REVIEWS</p>
          {summary.count > 0 ? (
            <>
              <div className="flex items-end gap-3">
                <span className="font-display text-5xl leading-none text-bone">{summary.average.toFixed(1)}</span>
                <div className="pb-1">
                  <StarRating value={summary.average} className="h-4 w-4" />
                  <p className="mt-1 text-xs text-stone">
                    {summary.count} review{summary.count === 1 ? "" : "s"}
                  </p>
                </div>
              </div>
              <div className="mt-5 flex flex-col gap-1.5">
                {[5, 4, 3, 2, 1].map((star) => {
                  const count = summary.distribution[star - 1];
                  const share = summary.count ? (count / summary.count) * 100 : 0;
                  return (
                    <div key={star} className="flex items-center gap-3 text-xs text-stone">
                      <span className="w-6 font-mono">{star}★</span>
                      <span className="h-1.5 flex-1 bg-line">
                        <span className="block h-full bg-mango" style={{ width: `${share}%` }} />
                      </span>
                      <span className="w-6 text-right font-mono">{count}</span>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <p className="text-sm text-stone">No reviews yet.</p>
          )}

          <div className="mt-7">
            {eligibility?.canReview ? (
              !writing && (
                <button
                  type="button"
                  onClick={() => setWriting(true)}
                  className="w-full border border-line-strong py-3.5 text-xs font-medium uppercase tracking-[0.18em] text-bone transition-colors hover:border-bone hover:bg-bone hover:text-void"
                >
                  Write a review
                </button>
              )
            ) : eligibility?.reason === "signed_out" ? (
              <button
                type="button"
                onClick={() => openAuth("signin")}
                className="w-full border border-line-strong py-3.5 text-xs font-medium uppercase tracking-[0.18em] text-bone transition-colors hover:border-bone"
              >
                Sign in to review
              </button>
            ) : eligibility?.reason === "already_reviewed" ? (
              <p className="text-xs text-stone">Thanks — you&apos;ve reviewed this product.</p>
            ) : eligibility?.reason === "not_purchased" ? (
              <p className="text-xs leading-relaxed text-stone">
                Reviews are written by customers who received this product.
              </p>
            ) : null}
          </div>
        </div>

        {/* List / form */}
        <div className="min-w-0 flex-1">
          {writing && eligibility?.canReview && (
            <ReviewForm
              productId={productId}
              productName={productName}
              purchased={[eligibility.color, eligibility.size].filter(Boolean).join(" / ")}
              onCancel={() => setWriting(false)}
              onDone={() => {
                setWriting(false);
                void load();
              }}
            />
          )}

          {reviews.length > 1 && (
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
              <p className="text-xs text-stone">
                {sort === "photos"
                  ? `${sorted.length} with photos`
                  : `${reviews.length} reviews`}
              </p>
              <label className="flex items-center gap-2 text-xs text-stone">
                Sort by
                <select
                  value={sort}
                  onChange={(event) => {
                    setSort(event.target.value as ReviewSort);
                    setVisible(PAGE_SIZE);
                  }}
                  className="border border-line-strong bg-void px-3 py-2 text-xs text-bone focus:border-bone focus:outline-none"
                >
                  {REVIEW_SORTS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}

          {reviews.length > 0 && sorted.length === 0 && (
            <p className="text-sm text-stone">No reviews with photos yet.</p>
          )}

          {sorted.length > 0 && (
            <ul className="divide-y divide-line">
              {sorted.slice(0, visible).map((review) => (
                <li key={review.id} className="py-7 first:pt-0">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <StarRating value={review.rating} />
                    {review.title && <p className="text-sm font-medium text-bone">{review.title}</p>}
                  </div>
                  <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-bone-dim">{review.body}</p>

                  {review.photos.length > 0 && (
                    <div className="mt-4 flex gap-2">
                      {review.photos.map((photo) => (
                        <button
                          key={photo}
                          type="button"
                          onClick={() => setZoomPhoto(photo)}
                          className="relative h-20 w-20 overflow-hidden border border-line-strong"
                          aria-label="View photo"
                        >
                          <Image src={photo} alt="" fill sizes="80px" className="object-cover" />
                        </button>
                      ))}
                    </div>
                  )}

                  <p className="mt-4 text-[11px] text-stone">
                    {review.authorName}
                    {review.verified && <span className="text-mango"> · Verified buyer</span>}
                    {(review.color || review.size) && <> · {[review.color, review.size].filter(Boolean).join(" / ")}</>}
                    {" · "}
                    {new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" }).format(new Date(review.createdAt))}
                  </p>

                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    {review.mine ? (
                      <span className="text-[11px] text-stone">
                        Your review{review.helpful ? ` · ${review.helpful} found it helpful` : ""}
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => void vote(review)}
                        disabled={voting === review.id}
                        aria-pressed={review.voted}
                        aria-label={`${review.voted ? "Remove helpful vote" : "Mark as helpful"} (${review.helpful ?? 0})`}
                        className={`border px-3 py-1.5 text-[10px] font-medium uppercase tracking-[0.14em] transition-colors disabled:opacity-50 ${
                          review.voted
                            ? "border-mango/60 text-mango"
                            : "border-line-strong text-stone hover:border-bone hover:text-bone"
                        }`}
                      >
                        {review.voted ? "✓ Helpful" : "Helpful?"}
                        {review.helpful ? ` · ${review.helpful}` : ""}
                      </button>
                    )}
                    {voteError?.id === review.id && (
                      <span role="alert" className="text-[11px] text-mango">{voteError.message}</span>
                    )}
                  </div>

                  {review.reply?.text && (
                    <div className="mt-4 border-l-2 border-mango/60 bg-charcoal/60 px-4 py-3">
                      <p className="label-technical text-mango">REPLY FROM MANGOSTA</p>
                      <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-bone-dim">
                        {review.reply.text}
                      </p>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}

          {sorted.length > visible && (
            <button
              type="button"
              onClick={() => setVisible((count) => count + PAGE_SIZE)}
              className="mt-4 border border-line-strong px-5 py-3 text-[10px] font-medium uppercase tracking-[0.18em] text-bone transition-colors hover:border-bone"
            >
              Show more reviews
            </button>
          )}
        </div>
      </div>

      {zoomPhoto && (
        <div
          className="fixed inset-0 z-[10030] flex items-center justify-center bg-void/90 p-6"
          role="dialog"
          aria-modal="true"
          aria-label="Review photo"
          onClick={() => setZoomPhoto(null)}
        >
          <div className="relative h-[80svh] w-full max-w-3xl">
            <Image src={zoomPhoto} alt="" fill sizes="768px" className="object-contain" />
          </div>
        </div>
      )}
    </div>
  );
}

/** Also used on the order page (Your Orders → order → Review your items). */
export function ReviewForm({
  productId,
  productName,
  purchased,
  onCancel,
  onDone,
  className = "mb-10",
}: {
  productId: string;
  productName: string;
  purchased: string;
  onCancel: () => void;
  onDone: () => void;
  className?: string;
}) {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const upload = async (files: FileList | null) => {
    const list = Array.from(files ?? []).slice(0, 3 - photos.length);
    if (list.length === 0) return;

    setUploading(true);
    setError(null);
    try {
      for (const file of list) {
        if (!file.type.startsWith("image/")) throw new Error(`${file.name} is not an image.`);
        if (file.size > 5 * 1024 * 1024) throw new Error(`${file.name} is larger than 5 MB.`);

        const form = new FormData();
        form.append("file", file);
        form.append("productId", productId);
        const response = await fetch("/api/reviews/upload", { method: "POST", body: form });
        const data = await response.json().catch(() => null);
        if (!response.ok || !data?.url) throw new Error(data?.error || "Upload failed.");
        setPhotos((current) => [...current, data.url].slice(0, 3));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (rating < 1) {
      setError("Please choose a star rating.");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, rating, title, body, photos }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || "Couldn't post your review.");
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't post your review.");
    } finally {
      setSaving(false);
    }
  };

  const shown = hover || rating;

  return (
    <form onSubmit={submit} className={`border border-line-strong bg-charcoal p-5 sm:p-6 ${className}`}>
      <p className="label-technical mb-1">YOUR REVIEW</p>
      <p className="mb-5 text-xs text-stone">
        {productName}{purchased ? ` · you bought ${purchased}` : ""}
      </p>

      <div className="mb-5 flex items-center gap-1" role="radiogroup" aria-label="Rating">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            role="radio"
            aria-checked={rating === star}
            aria-label={`${star} star${star === 1 ? "" : "s"}`}
            onMouseEnter={() => setHover(star)}
            onMouseLeave={() => setHover(0)}
            onClick={() => setRating(star)}
            className={`text-3xl leading-none transition-colors ${shown >= star ? "text-mango" : "text-stone-dark"}`}
          >
            ★
          </button>
        ))}
      </div>

      <label className="mb-4 flex flex-col gap-1.5">
        <span className="text-xs text-stone">Title (optional)</span>
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          maxLength={120}
          className="border border-line-strong bg-transparent px-3.5 py-2.5 text-sm text-bone focus:border-bone focus:outline-none"
          placeholder="Fits perfectly"
        />
      </label>

      <label className="mb-4 flex flex-col gap-1.5">
        <span className="text-xs text-stone">Your review</span>
        <textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          rows={4}
          maxLength={2000}
          required
          className="border border-line-strong bg-transparent px-3.5 py-2.5 text-sm text-bone focus:border-bone focus:outline-none"
          placeholder="How's the fit, fabric and feel?"
        />
      </label>

      <div className="mb-5">
        <p className="mb-2 text-xs text-stone">Photos (optional, up to 3)</p>
        <div className="flex flex-wrap gap-2">
          {photos.map((photo) => (
            <div key={photo} className="relative h-20 w-20 overflow-hidden border border-line-strong">
              <Image src={photo} alt="" fill sizes="80px" className="object-cover" />
              <button
                type="button"
                onClick={() => setPhotos((current) => current.filter((url) => url !== photo))}
                aria-label="Remove photo"
                className="absolute right-0 top-0 bg-void/80 px-1.5 text-xs text-bone"
              >
                ×
              </button>
            </div>
          ))}
          {photos.length < 3 && (
            <label className={`flex h-20 w-20 cursor-pointer items-center justify-center border border-dashed border-line-strong text-[10px] uppercase tracking-[0.14em] text-stone hover:border-bone hover:text-bone ${uploading ? "pointer-events-none opacity-50" : ""}`}>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                multiple
                className="hidden"
                onChange={(event) => {
                  void upload(event.target.files);
                  event.target.value = "";
                }}
              />
              {uploading ? "…" : "+ Photo"}
            </label>
          )}
        </div>
      </div>

      {error && <p role="alert" className="mb-4 text-xs text-mango">{error}</p>}

      <div className="flex flex-wrap gap-3">
        <button
          type="submit"
          disabled={saving || uploading}
          className="whitespace-nowrap bg-bone px-5 py-3 text-xs font-medium uppercase tracking-[0.18em] text-void transition-colors hover:bg-mango disabled:opacity-50"
        >
          {saving ? "Posting…" : "Post review"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="whitespace-nowrap border border-line-strong px-5 py-3 text-xs uppercase tracking-[0.18em] text-bone-dim hover:border-bone hover:text-bone"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
