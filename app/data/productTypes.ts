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
 *
 * KEY PRINCIPLE:
 * - `price` is the actual selling price (discount is applied to this)
 * - `compareAtPrice` is ONLY for display/comparison (shown as strikethrough)
 * - Discount is ALWAYS applied to `price`, never to `compareAtPrice`
 *
 * LOGIC:
 * 1. Always apply discountPercent to base `price` (if discount > 0)
 * 2. compareAtPrice is purely visual (for strikethrough display)
 * 3. Return the discounted price or base price if no discount
 */
/** The only product fields the price helpers read. */
export type ProductPricing = Pick<
  Product,
  "price" | "compareAtPrice" | "discountPercent"
>;

export function getProductSalePrice(product: ProductPricing): number {
  const basePrice = Math.max(0, Number(product.price) || 0);
  const discountPercent = Math.min(
    100,
    Math.max(0, Number(product.discountPercent) || 0)
  );

  if (discountPercent <= 0) {
    // No discount, return the base price
    return Number(basePrice.toFixed(2));
  }

  // Apply discount to base price (NOT compareAtPrice)
  const discountedPrice = basePrice - (basePrice * discountPercent) / 100;
  return Number(Math.max(0, discountedPrice).toFixed(2));
}

/**
 * The crossed-out "was" price shown next to the sale price, or null when
 * no crossed-out price should be shown. ONE rule for the whole site — every
 * component shows a strikethrough only when this returns a number:
 *
 *   discountPercent > 0  → compareAtPrice if set, otherwise price
 *   discountPercent = 0  → null: normal price only, even if compareAtPrice
 *                          is set (compareAtPrice has no effect on its own)
 *
 * Never returns a value that is not higher than the sale price.
 */
export function getProductStrikethroughPrice(
  product: ProductPricing
): number | null {
  if (!hasProductDiscount(product)) {
    return null;
  }

  const basePrice = Math.max(0, Number(product.price) || 0);
  const compareAtPrice = Math.max(0, Number(product.compareAtPrice) || 0);
  const wasPrice = compareAtPrice > 0 ? compareAtPrice : basePrice;

  return wasPrice > getProductSalePrice(product) ? wasPrice : null;
}

export function hasProductDiscount(product: ProductPricing): boolean {
  return Number(product.discountPercent) > 0;
}

/**
 * DEPRECATED: Use priceValidation.ts for strict validation
 * These are calculation helpers, not validators
 * @deprecated Use validateProductPricing() from app/lib/priceValidation.ts
 */
export function validateDiscountPercent(discount: unknown): number {
  const value = Number(discount) || 0;
  return Math.min(100, Math.max(0, value));
}

/**
 * DEPRECATED: Use priceValidation.ts for strict validation
 * These are calculation helpers, not validators
 * @deprecated Use validateProductPricing() from app/lib/priceValidation.ts
 */
export function validatePrice(price: unknown): number {
  const value = Number(price) || 0;
  return Math.max(0, value);
}

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}