"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Navigation from "@/app/components/Navigation";
import Footer from "@/app/components/Footer";
import ProductCard from "@/app/components/ProductCard";
import ProductQuickAddModal from "@/app/components/ProductQuickAddModal";
import { useAuth } from "@/app/components/AuthProvider";
import { useWishlistStore } from "@/app/store/useWishlistStore";
import { useProducts } from "@/app/lib/useProducts";
import { getProductSalePrice, LOW_STOCK_THRESHOLD } from "@/app/data/productTypes";

interface WishlistItem {
  productId: string;
  folder: string;
  addedAt: string;
  priceAtSave: number;
  inventoryAtSave: number;
}

type WishlistData = { items: WishlistItem[]; folders: string[] };

/** The signed-in customer's saved items and folders (null if it fails). */
async function fetchWishlist(): Promise<WishlistData | null> {
  const response = await fetch("/api/wishlist", {
    cache: "no-store",
  });

  const data = await response.json().catch(() => null);
  if (!response.ok) return null;

  return {
    items: Array.isArray(data?.items) ? data.items : [],
    folders:
      Array.isArray(data?.folders) && data.folders.length > 0
        ? data.folders
        : ["All saved"],
  };
}

export default function WishlistPage() {
  const { user, loading: authLoading, openAuth } = useAuth();
  const load = useWishlistStore((state) => state.load);
  const { products, isLoading } = useProducts();

  const [items, setItems] = useState<WishlistItem[]>([]);
  const [folders, setFolders] = useState<string[]>([]);
  const [activeFolder, setActiveFolder] = useState("All saved");
  const [activeFilter, setActiveFilter] = useState<
    "saved" | "low-stock" | "price-drop"
  >("saved");
  const [quickProductId, setQuickProductId] = useState<string | null>(null);
  const [shareUrl, setShareUrl] = useState("");

  const showWishlist = (data: WishlistData) => {
    setItems(data.items);
    setFolders(data.folders);
  };

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    void load(user.id);
    fetchWishlist()
      .then((data) => {
        if (!cancelled && data) showWishlist(data);
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [user, load]);

  const saved = useMemo(
    () =>
      items
        .map((item) =>
          products.find((product) => product.id === item.productId)
        )
        .filter(Boolean),
    [items, products]
  );

  const visibleItems = useMemo(() => {
    if (activeFilter === "low-stock") {
      return items.filter((item) => {
        const product = products.find((p) => p.id === item.productId);
        const stock = Number(product?.inventory) || 0;

        return stock > 0 && stock <= LOW_STOCK_THRESHOLD;
      });
    }

    if (activeFilter === "price-drop") {
      return items.filter((item) => {
        const product = products.find((p) => p.id === item.productId);

        return Boolean(
          product &&
            item.priceAtSave > 0 &&
            getProductSalePrice(product) < item.priceAtSave
        );
      });
    }

    return activeFolder === "All saved"
      ? items
      : items.filter((item) => item.folder === activeFolder);
  }, [activeFilter, activeFolder, items, products]);

  const visible = visibleItems
    .map((item) =>
      products.find((product) => product.id === item.productId)
    )
    .filter(Boolean);

  const lowStock = items.filter((item) => {
    const product = products.find((p) => p.id === item.productId);
    const stock = Number(product?.inventory) || 0;

    return stock > 0 && stock <= LOW_STOCK_THRESHOLD;
  }).length;

  const priceDrops = items.filter((item) => {
    const product = products.find((p) => p.id === item.productId);

    return Boolean(
      product &&
        item.priceAtSave > 0 &&
        getProductSalePrice(product) < item.priceAtSave
    );
  }).length;

  const quickProduct = quickProductId
    ? products.find((product) => product.id === quickProductId) ?? null
    : null;

  const ready = !authLoading && !!user && !isLoading;

  const share = async () => {
    const response = await fetch("/api/wishlist", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action: "share",
      }),
    });

    const data = await response.json();

    if (data?.url) {
      setShareUrl(`${window.location.origin}${data.url}`);
    }
  };

  return (
    <>
      <Navigation />

      <main
        id="main-content"
        className="min-h-screen bg-void px-5 pb-24 pt-28 sm:px-8 sm:pt-32 lg:px-12"
      >
        <div className="mx-auto max-w-[1600px]">
          <p className="label-technical mb-5">
            MANGOSTA / ACCOUNT
          </p>

          <div className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b border-line pb-7">
            <div>
              <h1 className="type-title text-bone">
                WISHLIST
              </h1>

              <p className="mt-3 text-sm text-stone">
                Keep the pieces you want close.
              </p>
            </div>

            {ready && (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void share()}
                  className="border border-line-strong px-4 py-2 text-[10px] tracking-[0.15em] text-bone hover:border-bone"
                >
                  SHARE WISHLIST
                </button>

                <Link
                  href="/account"
                  className="border border-line-strong px-4 py-2 text-[10px] tracking-[0.15em] text-bone hover:border-bone"
                >
                  MY ACCOUNT
                </Link>
              </div>
            )}
          </div>

          {!authLoading && !user && (
            <div className="flex flex-col items-center py-20 text-center">
              <p className="max-w-md text-sm leading-relaxed text-stone">
                Sign in to save pieces, receive wishlist alerts and access your
                wishlist from any device.
              </p>

              <button
                type="button"
                onClick={() => openAuth("signin")}
                className="mt-8 border border-line-strong px-8 py-4 text-xs tracking-[0.18em] text-bone hover:border-bone"
              >
                SIGN IN
              </button>
            </div>
          )}

          {ready && (
            <>
              {/* SUMMARY FILTERS */}
              <div className="grid gap-3 sm:grid-cols-3">
                <button
                  type="button"
                  onClick={() => {
                    setActiveFilter("saved");
                    setActiveFolder("All saved");
                  }}
                  className={`border p-5 text-left transition ${
                    activeFilter === "saved"
                      ? "border-bone bg-bone text-void"
                      : "border-line bg-charcoal text-bone hover:border-bone"
                  }`}
                >
                  <p
                    className={`label-technical ${
                      activeFilter === "saved"
                        ? "text-void/60"
                        : "text-stone"
                    }`}
                  >
                    SAVED
                  </p>

                  <p className="mt-2 type-heading">
                    {items.length}
                  </p>

                  <p
                    className={`mt-1 text-xs ${
                      activeFilter === "saved"
                        ? "text-void/60"
                        : "text-stone"
                    }`}
                  >
                    pieces
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setActiveFilter("low-stock");
                    setActiveFolder("All saved");
                  }}
                  className={`border p-5 text-left transition ${
                    activeFilter === "low-stock"
                      ? "border-mango bg-mango text-void"
                      : "border-line bg-charcoal text-bone hover:border-mango"
                  }`}
                >
                  <p
                    className={`label-technical ${
                      activeFilter === "low-stock"
                        ? "text-void/70"
                        : "text-stone"
                    }`}
                  >
                    LOW STOCK
                  </p>

                  <p className="mt-2 type-heading">
                    {lowStock}
                  </p>

                  <p
                    className={`mt-1 text-xs ${
                      activeFilter === "low-stock"
                        ? "text-void/70"
                        : "text-stone"
                    }`}
                  >
                    need attention
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setActiveFilter("price-drop");
                    setActiveFolder("All saved");
                  }}
                  className={`border p-5 text-left transition ${
                    activeFilter === "price-drop"
                      ? "border-mango bg-mango text-void"
                      : "border-line bg-charcoal text-bone hover:border-mango"
                  }`}
                >
                  <p
                    className={`label-technical ${
                      activeFilter === "price-drop"
                        ? "text-void/70"
                        : "text-stone"
                    }`}
                  >
                    PRICE DROPS
                  </p>

                  <p className="mt-2 type-heading">
                    {priceDrops}
                  </p>

                  <p
                    className={`mt-1 text-xs ${
                      activeFilter === "price-drop"
                        ? "text-void/70"
                        : "text-stone"
                    }`}
                  >
                    since you saved
                  </p>
                </button>
              </div>

              {/* SHARE LINK */}
              {shareUrl && (
                <div className="mt-5 border border-mango/40 bg-mango/5 p-4">
                  <p className="label-technical text-mango">
                    SHARE LINK
                  </p>

                  <p className="mt-2 break-all text-xs text-bone-dim">
                    {shareUrl}
                  </p>
                </div>
              )}

              {/* FOLDER NAVIGATION */}
              <div className="mt-8 flex flex-wrap items-center gap-2 border-b border-line pb-5">
                {folders.map((folder) => (
                  <button
                    key={folder}
                    type="button"
                    onClick={() => {
                      setActiveFolder(folder);
                      setActiveFilter("saved");
                    }}
                    className={`border px-3 py-2 text-[10px] tracking-[0.14em] ${
                      activeFolder === folder
                        ? "border-bone bg-bone text-void"
                        : "border-line-strong text-stone hover:border-bone"
                    }`}
                  >
                    {folder}
                  </button>
                ))}
              </div>

              {/* PRODUCTS */}
              {visible.length === 0 ? (
                <div className="flex flex-col items-center py-20 text-center">
                  <p className="text-sm text-stone">
                    {saved.length === 0
                      ? "Nothing saved yet."
                      : activeFilter === "low-stock"
                        ? "No low-stock pieces right now."
                        : activeFilter === "price-drop"
                          ? "No price drops right now."
                          : "No pieces in this folder yet."}
                  </p>

                  <Link
                    href="/shop"
                    className="mt-8 border border-line-strong px-8 py-4 text-xs tracking-[0.18em] text-bone hover:border-bone"
                  >
                    START SHOPPING
                  </Link>
                </div>
              ) : (
                <div className="-mx-5 grid grid-cols-2 gap-x-1 gap-y-8 sm:mx-0 sm:gap-x-6 sm:gap-y-12 lg:grid-cols-3 xl:grid-cols-4">
                  {visible.map(
                    (product) =>
                      product && (
                        <div key={product.id} className="min-w-0">
                          <div className="relative">
                            <ProductCard product={product} />

                            {Number(product.inventory) > 0 &&
                              Number(product.inventory) <= LOW_STOCK_THRESHOLD && (
                                <p className="mt-2 px-2 text-[10px] font-medium tracking-[0.14em] text-mango sm:px-2.5">
                                  ONLY {product.inventory} LEFT
                                </p>
                              )}
                          </div>
                        </div>
                      )
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </main>

      <Footer />

      <ProductQuickAddModal
        product={quickProduct}
        onClose={() => setQuickProductId(null)}
      />
    </>
  );
}