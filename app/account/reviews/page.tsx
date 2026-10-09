"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Navigation from "@/app/components/Navigation";
import EngagementTracker from "@/app/components/EngagementTracker";
import { useAuth } from "@/app/components/AuthProvider";
import { Skeleton } from "@/app/components/Skeleton";
import type { Product } from "@/app/data/productTypes";

/** Account → My reviews: the products the customer has reviewed. */
export default function MyReviewsPage() {
  const { user, loading, openAuth } = useAuth();
  const [ids, setIds] = useState<string[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  // The account whose reviews are loaded (still loading while it differs).
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const busy = Boolean(user) && loadedFor !== user?.id;

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    Promise.all([
      fetch("/api/reviews/mine", { cache: "no-store" }).then((response) => (response.ok ? response.json() : null)),
      fetch("/api/products", { cache: "no-store" }).then((response) => (response.ok ? response.json() : [])),
    ])
      .then(([reviews, productList]) => {
        if (cancelled) return;
        setIds(reviews?.productIds ?? []);
        setProducts(Array.isArray(productList) ? productList : []);
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setLoadedFor(user.id);
      });

    return () => {
      cancelled = true;
    };
  }, [user]);

  return (
    <>
      {user && <EngagementTracker event="page_view" path="/account/reviews" />}
      <Navigation />
      <main id="main-content" className="min-h-screen bg-void px-5 pb-24 pt-28 sm:px-8 sm:pt-32 lg:px-12">
        <div className="mx-auto max-w-4xl">
          <div className="flex items-end justify-between border-b border-line pb-7">
            <div>
              <p className="label-technical mb-4">MANGOSTA / ACCOUNT</p>
              <h1 className="type-title text-bone">MY REVIEWS</h1>
            </div>
            <Link href="/account" className="text-xs text-stone hover:text-bone">
              ACCOUNT
            </Link>
          </div>

          {loading || busy ? (
            <div className="mt-8 space-y-3">
              <Skeleton className="h-24" />
              <Skeleton className="h-24" />
            </div>
          ) : !user ? (
            <div className="py-16 text-center">
              <p className="text-sm text-stone">Sign in to see your reviewed products.</p>
              <button
                onClick={() => openAuth("signin")}
                className="mt-5 bg-bone px-6 py-3 text-xs tracking-[0.16em] text-void"
              >
                SIGN IN
              </button>
            </div>
          ) : ids.length === 0 ? (
            <div className="py-20 text-center">
              <p className="text-sm text-stone">You haven’t reviewed anything yet.</p>
              <Link
                href="/orders"
                className="mt-5 inline-block border border-line-strong px-5 py-3 text-xs tracking-[0.15em] text-bone"
              >
                VIEW ORDERS
              </Link>
            </div>
          ) : (
            <div className="mt-8 grid gap-3">
              {ids.map((id) => {
                const product = products.find((item) => item.id === id);
                return product ? (
                  <Link
                    key={id}
                    href={`/product/${product.slug}#reviews`}
                    className="flex items-center justify-between border border-line bg-charcoal p-5 hover:border-bone"
                  >
                    <div>
                      <p className="text-sm font-medium text-bone">{product.name}</p>
                      <p className="mt-1 text-xs text-stone">Verified review submitted</p>
                    </div>
                    <span className="text-xs text-mango">VIEW PRODUCT →</span>
                  </Link>
                ) : null;
              })}
            </div>
          )}
        </div>
      </main>
    </>
  );
}
