import "server-only";
import { getProducts as readStoredProducts } from "@/app/lib/dataStore";
import { toPublicProduct } from "./productTypes";

// Products for the storefront's Server Components (this file imports
// "server-only"). Client components fetch /api/products instead (or use
// the useProducts() hook in app/lib/useProducts.ts) and import types and
// pure helpers from app/data/productTypes.ts. Both paths read the same
// MongoDB products the admin panel edits, with stock numbers capped for
// the public (see toPublicProduct).

export type { ProductCategory, ProductColor, Product } from "./productTypes";
export { formatPrice, slugify } from "./productTypes";

async function readProductsFromStore() {
  return (await readStoredProducts()).map(toPublicProduct);
}

export async function getAllProducts() {
  return readProductsFromStore();
}

export async function getProductBySlug(slug: string) {
  const products = await readProductsFromStore();
  return products.find((p) => p.slug === slug);
}
