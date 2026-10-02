/**
 * Server-side product validation (price, discount, compare-at price,
 * inventory). Used by the admin product create/edit APIs, which reject
 * invalid values with HTTP 400 instead of silently correcting them.
 */

import { getProductSalePrice } from "@/app/data/productTypes";
import type { Product } from "@/app/data/productTypes";

/**
 * Validates inventory value itself (admin input validation)
 * Ensures inventory is a non-negative integer
 */
export function validateInventoryValue(inventory: unknown): { valid: boolean; error?: string } {
  const value = Number(inventory);

  if (!Number.isFinite(value)) {
    return { valid: false, error: "Inventory must be a finite number" };
  }

  if (!Number.isInteger(value)) {
    return { valid: false, error: "Inventory must be an integer" };
  }

  if (value < 0) {
    return { valid: false, error: "Inventory cannot be negative" };
  }

  return { valid: true };
}

/**
 * Validates a product's inventory against requested quantity
 * Returns error if quantity exceeds available stock
 */
export function validateInventory(
  product: Product,
  quantity: number
): { valid: boolean; error?: string } {
  const requestedQty = Math.max(1, quantity);
  const availableInventory = Math.max(0, product.inventory || 0);

  if (requestedQty > availableInventory) {
    return {
      valid: false,
      error: `${product.name} only has ${availableInventory} in stock (you requested ${requestedQty}).`,
    };
  }

  return { valid: true };
}

/**
 * Validates all product pricing and inventory fields
 * STRICT validation (rejects invalid values, doesn't normalize)
 */
export function validateProductPricing(product: Product): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Validate base price
  if (!Number.isFinite(product.price) || product.price < 0) {
    errors.push("Base price must be a non-negative finite number");
  }

  // Validate discount percent (null = not set: MongoDB stores undefined as null)
  if (product.discountPercent != null) {
    if (!Number.isFinite(product.discountPercent)) {
      errors.push("Discount percent must be a finite number");
    } else if (product.discountPercent < 0 || product.discountPercent > 100) {
      errors.push("Discount percent must be between 0 and 100");
    }
  }

  // Validate compareAtPrice if present (null = not set)
  if (product.compareAtPrice != null) {
    if (!Number.isFinite(product.compareAtPrice) || product.compareAtPrice < 0) {
      errors.push("compareAtPrice must be a non-negative finite number");
    } else {
      // compareAtPrice should be >= sale price
      const salePrice = getProductSalePrice(product);
      if (product.compareAtPrice < salePrice) {
        errors.push(`compareAtPrice (${product.compareAtPrice}) cannot be lower than sale price (${salePrice})`);
      }
    }
  }

  // Validate inventory
  const inventoryValidation = validateInventoryValue(product.inventory);
  if (!inventoryValidation.valid) {
    errors.push(`Inventory: ${inventoryValidation.error}`);
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Inventory is NOT modified anywhere in this file.
 *
 * The only stock-decrease path is placeOrder() in app/lib/dataStore.ts,
 * which reserves stock (conditional `$gte` + `$inc` update per product),
 * records the coupon use and saves the order inside one MongoDB transaction.
 *
 * Checkout does not need a separate "compare client prices" step: the
 * checkout API ignores browser prices and prices every line from the
 * database (getProductSalePrice).
 */
