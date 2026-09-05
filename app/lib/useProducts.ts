"use client";

import { useEffect, useState } from "react";
import type { Product } from "@/app/data/productTypes";

interface UseProductsResult {
  products: Product[];
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

/**
 * Client-side equivalent of the server-only accessors in app/data/products.ts.
 * Fetches from /api/products, which reads the same JSON store the admin
 * panel writes to - so client components always reflect the latest admin
 * edits (subject to the route's short cache window).
 */
export function useProducts(): UseProductsResult {
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refetchToken, setRefetchToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    fetch("/api/products")
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load products (${res.status})`);
        return res.json();
      })
      .then((data: Product[]) => {
        if (!cancelled) {
          setProducts(data);
          setError(null);
        }
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [refetchToken]);

  return {
    products,
    isLoading,
    error,
    refetch: () => setRefetchToken((t) => t + 1),
  };
}
