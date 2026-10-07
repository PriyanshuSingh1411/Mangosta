import type { Product, ProductColor } from "@/app/data/productTypes";
import {
  colorKey,
  getProductSizes,
  variantKey,
} from "@/app/data/productTypes";

// Cleans the newer product fields sent by the admin product form.

const MAX_COLOR_IMAGES = 8;
const MAX_LOOK_ITEMS = 4;

/** Keeps photo lists only for colours the product actually has. */
export function sanitizeColorImages(
  value: unknown,
  colors: ProductColor[]
): Record<string, string[]> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;

  const source = value as Record<string, unknown>;
  const result: Record<string, string[]> = {};

  for (const color of colors) {
    const key = colorKey(color.name);
    const list = Array.isArray(source[key]) ? (source[key] as unknown[]) : [];
    const urls = list
      .map((url) => String(url ?? "").trim())
      .filter((url) => /^https?:\/\//i.test(url) || url.startsWith("/"))
      .slice(0, MAX_COLOR_IMAGES);

    if (urls.length > 0) result[key] = urls;
  }

  return Object.keys(result).length > 0 ? result : undefined;
}

/** Up to 4 other, existing product ids. */
export function sanitizeCompleteTheLook(
  value: unknown,
  allProducts: Pick<Product, "id">[],
  selfId?: string
): string[] | undefined {
  if (!Array.isArray(value)) return undefined;

  const known = new Set(allProducts.map((product) => product.id));
  const ids = [...new Set(value.map((id) => String(id ?? "")))]
    .filter((id) => id && id !== selfId && known.has(id))
    .slice(0, MAX_LOOK_ITEMS);

  return ids.length > 0 ? ids : undefined;
}

/**
 * Stock per size & colour for every colour × size combination.
 * Returns null when the value is unusable (bad numbers).
 */
export function sanitizeVariantStock(
  value: unknown,
  colors: ProductColor[],
  sizes: string[]
): Record<string, number> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;

  const source = value as Record<string, unknown>;
  const colorNames = colors.length > 0 ? colors.map((color) => color.name) : [""];
  const result: Record<string, number> = {};

  for (const colorName of colorNames) {
    for (const size of getProductSizes({ sizes })) {
      const key = variantKey(colorName, size);
      const number = Number(source[key] ?? 0);

      if (!Number.isFinite(number) || !Number.isInteger(number) || number < 0 || number > 1_000_000) {
        return null;
      }

      result[key] = number;
    }
  }

  return Object.keys(result).length > 0 ? result : null;
}

export function sumStock(stock: Record<string, number>): number {
  return Object.values(stock).reduce((sum, value) => sum + value, 0);
}

export function sameStock(
  a: Record<string, number> | null | undefined,
  b: Record<string, number> | null | undefined
): boolean {
  const left = a ?? {};
  const right = b ?? {};
  const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
  for (const key of keys) {
    if ((Number(left[key]) || 0) !== (Number(right[key]) || 0)) return false;
  }
  return true;
}
