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
  /**
   * Total stock. When `variantStock` is used this is always the sum of
   * every size/colour cell (kept in step by the server).
   */
  inventory: number;
  /**
   * Optional stock per size & colour, keyed by variantKey(color, size).
   * Absent/empty = stock is tracked for the product as a whole (old way).
   */
  variantStock?: Record<string, number>;
  /**
   * Optional photos per colour, keyed by colorKey(colorName).
   * Index 0 = front, index 1 = back. Empty/missing = use `images`.
   */
  colorImages?: Record<string, string[]>;
  /** Up to 4 product ids shown as "Complete the look". */
  completeTheLook?: string[];
}

// ============================================================
// SIZE / COLOUR VARIANTS
// ============================================================

/** Size used when a product has no size list (e.g. caps). */
export const ONE_SIZE = "ONE SIZE";

function keyPart(value: string): string {
  const slug = String(value ?? "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (slug) return slug;

  // Names with no latin letters/digits still get a stable, safe key.
  const hex = Array.from(String(value ?? ""))
    .map((char) => char.codePointAt(0)!.toString(16))
    .join("");

  return hex ? `x${hex}` : "default";
}

/** Stable key for a colour name (used for colour photos). */
export function colorKey(colorName: string): string {
  return keyPart(colorName);
}

/** Stable key for one size + colour combination (used for stock). */
export function variantKey(colorName: string, size: string): string {
  return `${keyPart(colorName)}__${keyPart(size || ONE_SIZE)}`;
}

/** True when stock is tracked per size & colour for this product. */
export function hasVariantStock(
  product: Pick<Product, "variantStock">
): boolean {
  return Boolean(
    product.variantStock &&
      Object.keys(product.variantStock).length > 0
  );
}

/**
 * Units available for one size + colour. Falls back to the product's
 * total stock when stock isn't tracked per variant.
 */
export function getVariantStock(
  product: Pick<Product, "variantStock" | "inventory">,
  colorName: string,
  size: string
): number {
  if (hasVariantStock(product)) {
    return Math.max(
      0,
      Math.floor(
        Number(product.variantStock?.[variantKey(colorName, size)]) || 0
      )
    );
  }

  return Math.max(0, Math.floor(Number(product.inventory) || 0));
}

export function isVariantAvailable(
  product: Pick<Product, "variantStock" | "inventory">,
  colorName: string,
  size: string
): boolean {
  return getVariantStock(product, colorName, size) > 0;
}

// ============================================================
// PUBLIC STOCK (what shoppers' browsers receive)
// ============================================================

/**
 * The storefront never reveals more stock than this: counts above it are
 * sent as this number ("10 or more"), so exact stock levels stay private.
 * It is also the most of one size a customer can buy in one order.
 */
export const PUBLIC_STOCK_CAP = 10;
export const MAX_PER_SIZE_PER_ORDER = PUBLIC_STOCK_CAP;

/** "Only N left" is shown at or below this. */
export const LOW_STOCK_THRESHOLD = 3;

function capStock(value: unknown): number {
  return Math.min(PUBLIC_STOCK_CAP, Math.max(0, Math.floor(Number(value) || 0)));
}

/**
 * The product as the storefront receives it: stock numbers capped at
 * PUBLIC_STOCK_CAP (exact below it, so "Only 2 left" and sold-out sizes
 * still work). Everything else is unchanged. Server code that changes
 * stock always reads the real numbers from the database.
 */
export function toPublicProduct<T extends Product>(product: T): T {
  const variantStock = product.variantStock
    ? Object.fromEntries(
        Object.entries(product.variantStock).map(([key, value]) => [key, capStock(value)])
      )
    : product.variantStock;

  return {
    ...product,
    inventory: capStock(product.inventory),
    ...(variantStock ? { variantStock } : {}),
  };
}

/** "Sold out", "Only N left" (at or below LOW_STOCK_THRESHOLD) or "In stock". */
export function stockLabel(stock: number): { kind: "out" | "low" | "in"; text: string } {
  const units = Math.max(0, Math.floor(Number(stock) || 0));
  if (units <= 0) return { kind: "out", text: "Sold out" };
  if (units <= LOW_STOCK_THRESHOLD) return { kind: "low", text: `Only ${units} left` };
  return { kind: "in", text: "In stock" };
}

/** Sizes to offer for a product (ONE SIZE when the list is empty). */
export function getProductSizes(product: Pick<Product, "sizes">): string[] {
  return product.sizes.length > 0 ? product.sizes : [ONE_SIZE];
}

/** Photos for a colour; falls back to the product's main photos. */
export function getColorImages(
  product: Pick<Product, "images" | "colorImages">,
  colorName?: string | null
): string[] {
  if (colorName) {
    const list = product.colorImages?.[colorKey(colorName)];
    if (Array.isArray(list) && list.filter(Boolean).length > 0) {
      return list.filter(Boolean);
    }
  }

  return product.images ?? [];
}

/** Main photo for a cart / order line in a given colour. */
export function getLineImage(
  product: Pick<Product, "images" | "colorImages">,
  colorName?: string | null
): string {
  return getColorImages(product, colorName)[0] || product.images?.[0] || "";
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
 * The "SAVE x%" shown to shoppers: how much lower the sale price is than
 * the CROSSED-OUT price next to it (so the two numbers always agree),
 * rounded to a whole percent. null when nothing is crossed out.
 *
 *   ₹3,299 crossed out, ₹2,609.10 → 21  (even though the admin discount
 *   is 10% off the ₹2,899 base price)
 */
export function getProductSavingsPercent(product: ProductPricing): number | null {
  const wasPrice = getProductStrikethroughPrice(product);
  if (!wasPrice) return null;

  const percent = Math.round(((wasPrice - getProductSalePrice(product)) / wasPrice) * 100);
  return percent > 0 ? percent : null;
}

/** Saving per unit compared with the crossed-out price (0 when none). */
export function getProductSavingsAmount(product: ProductPricing): number {
  const wasPrice = getProductStrikethroughPrice(product);
  if (!wasPrice) return 0;
  return Number(Math.max(0, wasPrice - getProductSalePrice(product)).toFixed(2));
}

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
// ============================================================
// COMPLETE THE LOOK
// ============================================================

const LOOK_PAIRS: Record<ProductCategory, ProductCategory[]> = {
  "t-shirts": ["pants", "jackets", "accessories"],
  hoodies: ["pants", "accessories", "jackets"],
  jackets: ["t-shirts", "pants", "accessories"],
  pants: ["t-shirts", "hoodies", "jackets", "accessories"],
  accessories: ["t-shirts", "hoodies", "pants"],
};

/**
 * Products to pair with `product`: the ones the admin picked, otherwise
 * one in-stock product from each matching category.
 */
export function getCompleteTheLook<T extends Product>(
  product: Product,
  allProducts: T[],
  limit = 4
): T[] {
  const byId = new Map(allProducts.map((item) => [item.id, item]));

  if (product.completeTheLook && product.completeTheLook.length > 0) {
    return product.completeTheLook
      .map((id) => byId.get(id))
      .filter((item): item is T => Boolean(item) && item!.id !== product.id)
      .slice(0, limit);
  }

  const picks: T[] = [];
  for (const category of LOOK_PAIRS[product.category] ?? []) {
    const match = allProducts.find(
      (item) =>
        item.category === category &&
        item.id !== product.id &&
        (Number(item.inventory) || 0) > 0 &&
        !picks.includes(item)
    );
    if (match) picks.push(match);
    if (picks.length >= Math.min(limit, 3)) break;
  }

  return picks;
}
