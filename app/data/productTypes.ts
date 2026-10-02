// Types and pure functions only - no filesystem access, safe to import from
// both "use client" and Server Components. The server-only data-fetching
// functions live in app/data/products.ts (which imports "server-only") and
// re-export these types for convenience on the server side.

export type ProductCategory =
  | "t-shirts"
  | "hoodies"
  | "pants"
  | "jackets"
  | "accessories";

export interface ProductColor {
  name: string;
  hex: string;
}

export interface Product {
  id: string;
  slug: string;
  name: string;
  category: ProductCategory;
  price: number;
  compareAtPrice?: number;
  discountPercent?: number;

  // All product prices are stored/displayed in Indian Rupees.
  currency: "INR";

  description: string;
  details: string[];
  colors: ProductColor[];
  sizes: string[];
  images: string[]; // ordered gallery, index 0 = primary
  dropLabel?: string; // e.g. "DROP 01"
  isNew?: boolean;
  inventory: number;
}

export function formatPrice(value: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value) || 0);
}

/**
 * Returns the actual customer price after the product-level percentage discount.
 * `price` remains the original/base product price.
 */
export function getProductSalePrice(product: Product): number {
  const price = Math.max(0, Number(product.price) || 0);
  const discount = Math.min(
    100,
    Math.max(0, Number(product.discountPercent) || 0)
  );

  if (discount <= 0) {
    return Number(price.toFixed(2));
  }

  return Number(
    (price - (price * discount) / 100).toFixed(2)
  );
}

export function hasProductDiscount(product: Product): boolean {
  return Number(product.discountPercent) > 0;
}

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}