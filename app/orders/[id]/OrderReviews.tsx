"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ProductPlaceholderArt from "@/app/components/ProductPlaceholderArt";
import { ReviewForm } from "@/app/product/[slug]/ProductReviews";

type ReviewableOrder = {
  id: string;
  status: string;
  lines: {
    lineId: string;
    productId: string;
    productName: string;
    slug: string;
    image: string;
    color: string;
    size: string;
  }[];
};

type Eligibility =
  | { canReview: true; color: string; size: string }
  | { canReview: false; reason: "signed_out" | "not_purchased" | "already_reviewed" };

type Item = {
  productId: string;
  productName: string;
  slug: string;
  image: string;
  variants: string;
};

/**
 * "Review your items" on a delivered order. One row per product (a
 * customer reviews a product once, whichever colour/size they bought).
 * The review is posted to the product page straight away.
 */
export default function OrderReviews({ order }: { order: ReviewableOrder }) {
  const items = useMemo<Item[]>(() => {
    const byProduct = new Map<string, Item>();
    for (const line of order.lines) {
      const variant = [line.color, line.size].filter(Boolean).join(" / ");
      const existing = byProduct.get(line.productId);
      if (existing) {
        if (variant && !existing.variants.split(", ").includes(variant)) {
          existing.variants = existing.variants ? `${existing.variants}, ${variant}` : variant;
        }
      } else {
        byProduct.set(line.productId, {
          productId: line.productId,
          productName: line.productName,
          slug: line.slug,
          image: line.image,
          variants: variant,
        });
      }
    }
    return [...byProduct.values()];
  }, [order.lines]);

  const delivered = order.status === "delivered";
  const [eligibility, setEligibility] = useState<Record<string, Eligibility | null>>({});
  const [loaded, setLoaded] = useState(false);
  const [writing, setWriting] = useState<string | null>(null);
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set());
  // The one-product auto-open happens on the first load only (not again
  // after the review is posted or the form is cancelled).
  const autoOpenChecked = useRef(false);

  const load = useCallback(() => {
    return Promise.all(
      items.map((item) =>
        fetch(`/api/reviews?productId=${encodeURIComponent(item.productId)}`, { cache: "no-store" })
          .then((response) => (response.ok ? response.json() : null))
          .then((data) => [item.productId, (data?.eligibility as Eligibility | undefined) ?? null] as const)
          .catch(() => [item.productId, null] as const)
      )
    ).then((entries) => {
      setEligibility(Object.fromEntries(entries));
      setLoaded(true);

      // "Review your items" on a ONE-product order → open "Write a review"
      // straight away. With 2+ products the customer picks one.
      if (!autoOpenChecked.current) {
        autoOpenChecked.current = true;
        const only = items.length === 1 ? entries[0] : undefined;
        if (window.location.hash === "#review" && only?.[1]?.canReview) {
          setWriting(only[0]);
        }
      }
    });
  }, [items]);

  useEffect(() => {
    if (!delivered) return;
    void load();
  }, [delivered, load]);

  // Coming from the "Review your items" email/link: scroll here once the
  // section has loaded (the page renders after the order is fetched).
  useEffect(() => {
    if (loaded && window.location.hash === "#review") {
      document.getElementById("review")?.scrollIntoView({ block: "start" });
    }
  }, [loaded]);

  if (!delivered || items.length === 0) return null;

  const reviewedCount = items.filter((item) => {
    const state = eligibility[item.productId];
    return state && !state.canReview && state.reason === "already_reviewed";
  }).length;

  return (
    <section id="review" className="print-hidden mt-8 scroll-mt-28 border border-line bg-charcoal">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-5 sm:px-7">
        <p className="label-technical">REVIEW YOUR ITEMS</p>
        {loaded && (
          <p className="text-xs text-stone">
            {reviewedCount === items.length
              ? "All reviewed — thank you"
              : `${reviewedCount} of ${items.length} reviewed`}
          </p>
        )}
      </div>

      <ul className="divide-y divide-line px-5 sm:px-7">
        {items.map((item) => {
          const state = eligibility[item.productId];
          const reviewed = state && !state.canReview && state.reason === "already_reviewed";
          const isWriting = writing === item.productId;
          const imageKey = `review-${item.productId}`;

          return (
            <li key={item.productId} className="py-5">
              <div className="flex items-center gap-4">
                <div className="relative h-20 w-16 shrink-0 overflow-hidden bg-void">
                  {item.image && !failedImages.has(imageKey) ? (
                    <Image
                      src={item.image}
                      alt={item.productName}
                      fill
                      sizes="64px"
                      className="object-cover"
                      onError={() =>
                        setFailedImages((previous) => new Set(previous).add(imageKey))
                      }
                    />
                  ) : (
                    <ProductPlaceholderArt seed={item.productId} className="h-full w-full" />
                  )}
                </div>

                <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-bone">{item.productName}</p>
                    {item.variants && <p className="mt-1 text-xs text-stone">{item.variants}</p>}
                  </div>

                  <div className="shrink-0 sm:text-right">
                    {!loaded ? (
                      <span className="text-xs text-stone">…</span>
                    ) : reviewed ? (
                      <div className="flex flex-col items-start gap-1 sm:items-end">
                        <span className="text-xs font-medium tracking-[0.12em] text-mango">✓ REVIEWED</span>
                        <Link
                          href={`/product/${item.slug}#reviews`}
                          className="text-[11px] text-stone underline underline-offset-4 transition-colors hover:text-bone"
                        >
                          See it on the product page
                        </Link>
                      </div>
                    ) : state?.canReview ? (
                      !isWriting && (
                        <button
                          type="button"
                          onClick={() => setWriting(item.productId)}
                          aria-label={`Write a review for ${item.productName}`}
                          className="border border-line-strong px-4 py-2.5 text-[10px] font-medium uppercase tracking-[0.16em] text-bone transition-colors hover:border-bone hover:bg-bone hover:text-void sm:px-5 sm:text-xs"
                        >
                          Write a review
                        </button>
                      )
                    ) : state === null ? (
                      <button
                        type="button"
                        onClick={() => void load()}
                        className="text-xs text-stone underline underline-offset-4 hover:text-bone"
                      >
                        Couldn&apos;t load — retry
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>

              {isWriting && state?.canReview && (
                <div className="mt-5">
                  <ReviewForm
                    productId={item.productId}
                    productName={item.productName}
                    purchased={item.variants}
                    className=""
                    onCancel={() => setWriting(null)}
                    onDone={() => {
                      setWriting(null);
                      void load();
                    }}
                  />
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
