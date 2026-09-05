"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import type { Product } from "@/app/data/productTypes";
import { formatPrice } from "@/app/data/productTypes";

export default function AdminProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const load = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/admin/products");
      if (!res.ok) throw new Error("Failed to load products.");
      setProducts(await res.json());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete "${name}"? This can't be undone.`)) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/admin/products/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete product.");
      const data = await res.json();
      setProducts(data.products);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete product.");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div>
      <div className="mb-10 flex items-center justify-between">
        <div>
          <p className="label-technical mb-2">CATALOG</p>
          <h1 className="font-display text-3xl tracking-tight text-bone">Products</h1>
        </div>
        <Link
          href="/admin/products/new"
          className="bg-bone px-5 py-2.5 text-xs font-medium tracking-[0.15em] text-void transition-colors hover:bg-mango"
        >
          + NEW PRODUCT
        </Link>
      </div>

      {isLoading && <p className="text-sm text-stone">Loading…</p>}
      {error && <p className="text-sm text-mango">{error}</p>}

      {!isLoading && !error && products.length === 0 && (
        <div className="border border-line px-6 py-16 text-center">
          <p className="mb-4 text-sm text-stone">No products yet.</p>
          <Link
            href="/admin/products/new"
            className="text-xs tracking-[0.15em] text-bone underline underline-offset-4"
          >
            Create your first product
          </Link>
        </div>
      )}

      {!isLoading && !error && products.length > 0 && (
        <div className="border border-line">
          <div className="hidden grid-cols-[auto_1fr_auto_auto_auto_auto] items-center gap-4 border-b border-line px-5 py-3 sm:grid">
            <span className="label-technical">IMG</span>
            <span className="label-technical">NAME</span>
            <span className="label-technical">CATEGORY</span>
            <span className="label-technical">PRICE</span>
            <span className="label-technical">STOCK</span>
            <span className="label-technical text-right">ACTIONS</span>
          </div>
          {products.map((product, i) => (
            <div
              key={product.id}
              className={`grid grid-cols-[auto_1fr_auto] items-center gap-4 px-5 py-4 sm:grid-cols-[auto_1fr_auto_auto_auto_auto] ${
                i !== products.length - 1 ? "border-b border-line" : ""
              }`}
            >
              <div className="relative h-12 w-10 shrink-0 overflow-hidden bg-charcoal">
                {product.images[0] && (
                  <Image
                    src={product.images[0]}
                    alt=""
                    fill
                    sizes="40px"
                    className="object-cover"
                  />
                )}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm text-bone">{product.name}</p>
                <p className="text-xs text-stone">{product.slug}</p>
              </div>
              <span className="hidden text-xs text-stone sm:block">{product.category}</span>
              <span className="hidden font-mono text-sm text-bone-dim sm:block">
                {formatPrice(product.price)}
              </span>
              <span
                className={`hidden text-xs sm:block ${
                  product.inventory === 0
                    ? "text-mango"
                    : product.inventory <= 10
                    ? "text-stone"
                    : "text-stone"
                }`}
              >
                {product.inventory === 0 ? "Out of stock" : `${product.inventory} in stock`}
              </span>
              <div className="col-span-3 flex justify-end gap-4 sm:col-span-1">
                <Link
                  href={`/admin/products/${product.id}`}
                  className="text-xs text-stone transition-colors hover:text-bone"
                >
                  Edit
                </Link>
                <button
                  type="button"
                  onClick={() => handleDelete(product.id, product.name)}
                  disabled={deletingId === product.id}
                  className="text-xs text-stone transition-colors hover:text-mango disabled:opacity-50"
                >
                  {deletingId === product.id ? "…" : "Delete"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
