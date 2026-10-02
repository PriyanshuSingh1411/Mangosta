"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import gsap from "gsap";
import { getProductSalePrice } from "@/app/data/productTypes";
import type { Product, ProductCategory } from "@/app/data/productTypes";
import ProductCard from "@/app/components/ProductCard";
import { useCartStore } from "@/app/store/useCartStore";

const CATEGORIES: { label: string; value: ProductCategory | "all" }[] = [
  { label: "All", value: "all" },
  { label: "T-Shirts", value: "t-shirts" },
  { label: "Hoodies", value: "hoodies" },
  { label: "Pants", value: "pants" },
  { label: "Jackets", value: "jackets" },
  { label: "Accessories", value: "accessories" },
];

const SORT_OPTIONS = [
  { label: "Featured", value: "featured" },
  { label: "Newest", value: "newest" },
  { label: "Price: Low → High", value: "price-asc" },
  { label: "Price: High → Low", value: "price-desc" },
] as const;

type SortValue = (typeof SORT_OPTIONS)[number]["value"];

export default function ShopGrid({
  products: allProducts,
  initialCategory = "all" as ProductCategory | "all",
}: {
  products: Product[];
  initialCategory?: ProductCategory | "all";
}) {
  const [category, setCategory] = useState<ProductCategory | "all">(initialCategory);
  const [sort, setSort] = useState<SortValue>("featured");
  const gridRef = useRef<HTMLDivElement>(null);
  const { searchQuery } = useCartStore();

  const products = useMemo(() => {
    let list = allProducts;

    // Filter by category
    if (category !== "all") {
      list = list.filter((p) => p.category === category);
    }

    // Filter by search query (name, category, description, and details)
    if (searchQuery.trim().length > 0) {
      // Normalize text by removing hyphens and extra spaces for flexible matching
      const normalizeText = (text: string) =>
        text.toLowerCase().replace(/[-\s]+/g, "");

      const normalizedQuery = normalizeText(searchQuery);

      list = list.filter((p) => {
        const searchText = [
          p.name,
          p.category,
          p.description,
          ...p.details,
          p.dropLabel,
        ]
          .filter(Boolean)
          .join(" ");

        // Try both exact match and normalized match
        const lowerText = searchText.toLowerCase();
        return (
          lowerText.includes(searchQuery.toLowerCase()) ||
          normalizeText(searchText).includes(normalizedQuery)
        );
      });
    }

    // Sort
    switch (sort) {
      case "newest":
        list = [...list].sort((a, b) => Number(b.isNew) - Number(a.isNew));
        break;
      case "price-asc":
        list = [...list].sort((a, b) => getProductSalePrice(a) - getProductSalePrice(b));
        break;
      case "price-desc":
        list = [...list].sort((a, b) => getProductSalePrice(b) - getProductSalePrice(a));
        break;
      default:
        break;
    }
    return list;
  }, [allProducts, category, sort, searchQuery]);

  useEffect(() => {
    const cards = gridRef.current?.children;
    if (!cards) return;
    gsap.fromTo(
      cards,
      { opacity: 0, y: 24 },
      { opacity: 1, y: 0, duration: 0.5, stagger: 0.05, ease: "power2.out" }
    );
  }, [category, sort, searchQuery]);

  return (
    <div>
      <div className="mb-10 flex flex-col gap-6 sm:mb-14 sm:flex-row sm:items-center sm:justify-between">
        <div className="no-scrollbar flex gap-2 overflow-x-auto">
          {CATEGORIES.map((c) => (
            <button
              key={c.value}
              type="button"
              onClick={() => setCategory(c.value)}
              className={`shrink-0 px-4 py-2 text-xs tracking-[0.1em] transition-colors ${
                category === c.value
                  ? "bg-bone text-void"
                  : "border border-line-strong text-bone-dim hover:border-bone hover:text-bone"
              }`}
              aria-pressed={category === c.value}
            >
              {c.label.toUpperCase()}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <label htmlFor="sort-select" className="label-technical shrink-0">
            SORT
          </label>
          <select
            id="sort-select"
            value={sort}
            onChange={(e) => setSort(e.target.value as SortValue)}
            className="border border-line-strong bg-transparent px-3 py-2 text-xs tracking-[0.05em] text-bone-dim focus:outline-none focus:border-bone"
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value} className="bg-charcoal text-bone">
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {searchQuery.trim().length > 0 && (
        <div className="mb-8 p-4 bg-charcoal border border-line rounded">
          <p className="text-sm text-bone">
            Showing <span className="font-semibold">{products.length}</span> result
            {products.length !== 1 ? "s" : ""} for{" "}
            <span className="font-semibold">&ldquo;{searchQuery}&rdquo;</span>
          </p>
        </div>
      )}

      {products.length === 0 ? (
        <p className="py-20 text-center text-sm text-stone">
          {searchQuery.trim().length > 0
            ? `No products found for "${searchQuery}"`
            : "No products in this category yet."}
        </p>
      ) : (
        <div
          ref={gridRef}
          className="grid grid-cols-2 gap-x-4 gap-y-10 sm:gap-x-6 sm:gap-y-14 lg:grid-cols-3 xl:grid-cols-4"
        >
          {products.map((product, i) => (
            <ProductCard key={product.id} product={product} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}