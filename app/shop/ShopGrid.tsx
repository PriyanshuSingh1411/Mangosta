"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import gsap from "gsap";
import {
  getProductSalePrice,
  getProductSizes,
  isVariantAvailable,
} from "@/app/data/productTypes";
import type { Product, ProductCategory } from "@/app/data/productTypes";
import type { ReviewSummary } from "@/app/data/storeTypes";
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

const SIZE_ORDER = ["XXS", "XS", "S", "M", "L", "XL", "XXL", "XXXL", "3XL", "4XL"];

function sortSizes(sizes: string[]): string[] {
  return [...sizes].sort((a, b) => {
    const ia = SIZE_ORDER.indexOf(a.toUpperCase());
    const ib = SIZE_ORDER.indexOf(b.toUpperCase());
    if (ia !== -1 && ib !== -1) return ia - ib;
    if (ia !== -1) return -1;
    if (ib !== -1) return 1;
    const na = Number(a);
    const nb = Number(b);
    if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb;
    return a.localeCompare(b);
  });
}

/** In stock in that size (any colour), or that colour + size if given. */
function matchesSizeAndColor(product: Product, sizes: string[], colors: string[]): boolean {
  const productSizes = getProductSizes(product);
  const productColors = product.colors.length > 0 ? product.colors.map((c) => c.name) : [""];

  const colorOptions = colors.length > 0 ? productColors.filter((c) => colors.includes(c)) : productColors;
  if (colors.length > 0 && colorOptions.length === 0) return false;

  if (sizes.length === 0) return true;

  return sizes.some(
    (size) =>
      productSizes.includes(size) &&
      colorOptions.some((color) => isVariantAvailable(product, color, size))
  );
}

export default function ShopGrid({
  products: allProducts,
  initialCategory = "all" as ProductCategory | "all",
  ratings = {},
}: {
  products: Product[];
  initialCategory?: ProductCategory | "all";
  ratings?: Record<string, ReviewSummary>;
}) {
  const [category, setCategory] = useState<ProductCategory | "all">(initialCategory);
  const [sort, setSort] = useState<SortValue>("featured");
  const [sizeFilter, setSizeFilter] = useState<string[]>([]);
  const [colorFilter, setColorFilter] = useState<string[]>([]);
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [inStockOnly, setInStockOnly] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Filter choices come from the products in the chosen category.
  const options = useMemo(() => {
    const scope = category === "all" ? allProducts : allProducts.filter((p) => p.category === category);
    const sizes = new Set<string>();
    const colors = new Map<string, string>();
    for (const product of scope) {
      product.sizes.forEach((size) => sizes.add(size));
      product.colors.forEach((color) => {
        if (!colors.has(color.name)) colors.set(color.name, color.hex);
      });
    }
    return {
      sizes: sortSizes([...sizes]),
      colors: [...colors.entries()].map(([name, hex]) => ({ name, hex })),
    };
  }, [allProducts, category]);

  const activeFilterCount =
    sizeFilter.length + colorFilter.length + (minPrice ? 1 : 0) + (maxPrice ? 1 : 0) + (inStockOnly ? 1 : 0);

  const clearFilters = () => {
    setSizeFilter([]);
    setColorFilter([]);
    setMinPrice("");
    setMaxPrice("");
    setInStockOnly(false);
  };

  const toggle = (list: string[], value: string) =>
    list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
  const gridRef = useRef<HTMLDivElement>(null);
  const { searchQuery } = useCartStore();

  const products = useMemo(() => {
    let list = allProducts;

    // Filter by category
    if (category !== "all") {
      list = list.filter((p) => p.category === category);
    }

    // Size / colour (only sizes that are in stock count)
    if (sizeFilter.length > 0 || colorFilter.length > 0) {
      list = list.filter((p) => matchesSizeAndColor(p, sizeFilter, colorFilter));
    }

    // Price (customer price after discount)
    const min = Number(minPrice);
    const max = Number(maxPrice);
    if (minPrice && Number.isFinite(min)) {
      list = list.filter((p) => getProductSalePrice(p) >= min);
    }
    if (maxPrice && Number.isFinite(max)) {
      list = list.filter((p) => getProductSalePrice(p) <= max);
    }

    if (inStockOnly) {
      list = list.filter((p) => (Number(p.inventory) || 0) > 0);
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
  }, [allProducts, category, sort, searchQuery, sizeFilter, colorFilter, minPrice, maxPrice, inStockOnly]);

  useEffect(() => {
    const cards = gridRef.current?.children;
    if (!cards) return;
    gsap.fromTo(
      cards,
      { opacity: 0, y: 24 },
      { opacity: 1, y: 0, duration: 0.5, stagger: 0.05, ease: "power2.out" }
    );
  }, [category, sort, searchQuery, sizeFilter, colorFilter, minPrice, maxPrice, inStockOnly]);

  return (
    <div>
      <div className="sticky top-[76px] z-40 -mx-5 mb-10 border-y border-line bg-void/95 px-5 py-4 backdrop-blur-xl sm:static sm:mx-0 sm:mb-14 sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
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
          <button
            type="button"
            onClick={() => setFiltersOpen((open) => !open)}
            aria-expanded={filtersOpen}
            aria-controls="shop-filters"
            className={`border px-3 py-2 text-xs tracking-[0.1em] transition-colors ${
              filtersOpen || activeFilterCount > 0
                ? "border-bone text-bone"
                : "border-line-strong text-bone-dim hover:border-bone hover:text-bone"
            }`}
          >
            FILTERS{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
          </button>
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
      </div>

      {filtersOpen && (
        <div id="shop-filters" className="mb-10 grid gap-6 border border-line-strong bg-charcoal/40 p-5 sm:grid-cols-2 lg:grid-cols-4">
          {options.sizes.length > 0 && (
            <fieldset>
              <legend className="label-technical mb-3">SIZE (IN STOCK)</legend>
              <div className="flex flex-wrap gap-2">
                {options.sizes.map((size) => (
                  <button
                    key={size}
                    type="button"
                    onClick={() => setSizeFilter((list) => toggle(list, size))}
                    aria-pressed={sizeFilter.includes(size)}
                    className={`min-w-11 border px-2.5 py-2 text-xs transition-colors ${
                      sizeFilter.includes(size)
                        ? "border-bone bg-bone text-void"
                        : "border-line-strong text-bone-dim hover:border-bone hover:text-bone"
                    }`}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </fieldset>
          )}

          {options.colors.length > 0 && (
            <fieldset>
              <legend className="label-technical mb-3">COLOUR</legend>
              <div className="flex flex-wrap gap-2.5">
                {options.colors.map((color) => (
                  <button
                    key={color.name}
                    type="button"
                    onClick={() => setColorFilter((list) => toggle(list, color.name))}
                    aria-pressed={colorFilter.includes(color.name)}
                    aria-label={color.name}
                    title={color.name}
                    className={`h-8 w-8 rounded-full border-2 transition-transform ${
                      colorFilter.includes(color.name) ? "scale-110 border-mango" : "border-line-strong hover:border-bone-dim"
                    }`}
                    style={{ backgroundColor: color.hex }}
                  />
                ))}
              </div>
            </fieldset>
          )}

          <fieldset>
            <legend className="label-technical mb-3">PRICE (₹)</legend>
            <div className="flex items-center gap-2">
              <input
                type="number"
                inputMode="numeric"
                min="0"
                placeholder="Min"
                value={minPrice}
                onChange={(e) => setMinPrice(e.target.value)}
                aria-label="Minimum price"
                className="w-full min-w-0 border border-line-strong bg-transparent px-3 py-2 text-xs text-bone placeholder:text-stone-dark focus:border-bone focus:outline-none"
              />
              <span className="text-stone">–</span>
              <input
                type="number"
                inputMode="numeric"
                min="0"
                placeholder="Max"
                value={maxPrice}
                onChange={(e) => setMaxPrice(e.target.value)}
                aria-label="Maximum price"
                className="w-full min-w-0 border border-line-strong bg-transparent px-3 py-2 text-xs text-bone placeholder:text-stone-dark focus:border-bone focus:outline-none"
              />
            </div>
          </fieldset>

          <fieldset className="flex flex-col justify-between gap-4">
            <label className="flex items-center gap-2 text-xs text-bone-dim">
              <input
                type="checkbox"
                checked={inStockOnly}
                onChange={(e) => setInStockOnly(e.target.checked)}
                className="h-4 w-4 accent-[color:var(--color-mango)]"
              />
              In stock only
            </label>
            {activeFilterCount > 0 && (
              <button
                type="button"
                onClick={clearFilters}
                className="w-fit text-xs text-stone underline underline-offset-4 hover:text-bone"
              >
                Clear all filters
              </button>
            )}
          </fieldset>
        </div>
      )}

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
        <div className="py-20 text-center">
          <p className="text-sm text-stone">
            {searchQuery.trim().length > 0
              ? `No products found for "${searchQuery}"`
              : activeFilterCount > 0
                ? "No products match these filters."
                : "No products in this category yet."}
          </p>
          {activeFilterCount > 0 && (
            <button
              type="button"
              onClick={clearFilters}
              className="mt-5 border border-line-strong px-5 py-3 text-xs tracking-[0.15em] text-bone hover:border-bone"
            >
              CLEAR FILTERS
            </button>
          )}
        </div>
      ) : (
        <div
  ref={gridRef}
  className="grid grid-cols-2 gap-x-4 gap-y-10 sm:gap-x-6 sm:gap-y-14 lg:grid-cols-3 xl:grid-cols-4"
>
  {products.map((product) => (
    <ProductCard
      key={product.id}
      product={product}
      rating={ratings[product.id]}
    />
  ))}
</div>
      )}
    </div>
  );
}