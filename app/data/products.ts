import "server-only";
import { getProducts as readProductsFromStore } from "@/app/lib/dataStore";

// Server Components only (this file imports "server-only" and the data
// store hits the filesystem). Client components must NOT import from here -
// instead fetch from /api/products, use the useProducts() client hook in
// app/lib/useProducts.ts, or import types/formatPrice/slugify directly from
// app/data/productTypes.ts (which has no server dependency). All paths read
// through the same JSON store (data/products.json), which is also what the
// admin panel edits, so the storefront and admin are always looking at the
// same data.

export type { ProductCategory, ProductColor, Product } from "./productTypes";
export { formatPrice, slugify } from "./productTypes";

export async function getAllProducts() {
  return readProductsFromStore();
}

export async function getProductBySlug(slug: string) {
  const products = await readProductsFromStore();
  return products.find((p) => p.slug === slug);
}

export async function getFeaturedProducts() {
  const products = await readProductsFromStore();
  return products.filter((p) => p.isNew);
}

export async function getProductsByCategory(
  category: import("./productTypes").ProductCategory | "all"
) {
  const products = await readProductsFromStore();
  if (category === "all") return products;
  return products.filter((p) => p.category === category);
}
