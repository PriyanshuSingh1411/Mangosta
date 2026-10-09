"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import type { Product } from "@/app/data/productTypes";
import { formatPrice, getProductSalePrice, LOW_STOCK_THRESHOLD } from "@/app/data/productTypes";

type Item = { productId: string; folder: string; priceAtSave: number; inventoryAtSave: number; addedAt: string };

export default function SharedWishlist({ token }: { token: string }) {
  const [data, setData] = useState<{ products: Product[]; items: Item[] } | null>(null);

  useEffect(() => {
    fetch(`/api/wishlist/share/${encodeURIComponent(token)}`, { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((value) => setData(value))
      .catch(() => setData(null));
  }, [token]);

  if (!data) return <p className="label-technical py-20 text-center">LOADING WISHLIST…</p>;

  return (
    <div className="mx-auto max-w-[1400px]">
      <p className="label-technical mb-5">MANGOSTA / SHARED WISHLIST</p>
      <div className="mb-12 flex items-end justify-between gap-4 border-b border-line pb-7">
        <h1 className="type-title text-bone">WISHLIST</h1>
        <span className="label-technical text-stone">{data.products.length} ITEMS</span>
      </div>
      {data.products.length === 0 ? (
        <p className="py-20 text-center text-sm text-stone">This wishlist is empty.</p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4">
          {data.products.map((product) => (
            <Link key={product.id} href={`/product/${product.slug}`} className="group">
              <div className="relative aspect-[3/4] overflow-hidden bg-charcoal">
                {product.images[0] && <Image src={product.images[0]} alt={product.name} fill sizes="25vw" className="object-contain transition-transform duration-500 group-hover:scale-[1.02]" />}
              </div>
              <div className="mt-4 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="break-words text-sm font-medium text-bone">{product.name}</h2>
                  <p className="mt-1 type-price text-xs text-stone">{formatPrice(getProductSalePrice(product))}</p>
                </div>
                {(Number(product.inventory) || 0) <= LOW_STOCK_THRESHOLD && (Number(product.inventory) || 0) > 0 && <span className="shrink-0 text-[10px] text-mango">ONLY {product.inventory} LEFT</span>}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
