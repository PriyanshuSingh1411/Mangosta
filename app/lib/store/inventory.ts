import "server-only";

import clientPromise from "@/app/lib/mongodb";
import type { ClientSession } from "mongodb";
import { hasVariantStock, variantKey } from "@/app/data/productTypes";
import { supportsTransactions } from "./core";
import { getProductsCollection } from "./products";
import type { OrderLine } from "./orders";

// Stock: the single path that takes stock out (and puts it back) for orders,
// cancellations, returns and exchanges.

// ============================================================
// INVENTORY
//
// Single stock-decrease path for the whole app:
//
//   placeOrder()  →  atomicDecrementInventory()   (per product, or per
//                                                   size & colour when the
//                                                   product tracks that)
//
//   takeStockForExchange()  →  the same atomicDecrementInventory(), for
//                               the replacement item of an approved
//                               exchange (Admin → Returns)
//
// The two helpers below are exported only for placeOrder() in orders.ts
// and are NOT re-exported from app/lib/dataStore.ts, so nothing else in
// the app can decrease stock. createOrder() never reads or writes
// inventory. The admin product APIs only *set* an absolute stock
// value (a stock-take), they never decrement it — and on edit only
// via compare-and-set in updateProduct(), so sales are never lost.
// restockLines() (returns) only ever adds stock back.
// ============================================================

export type InventoryRequest = {
  productId: string;
  productName: string;
  quantity: number;
  /** variantStock key, or null when stock is tracked per product. */
  variant: string | null;
  color: string;
  size: string;
};

export type UnavailableProduct = {
  productId: string;
  productName: string;
  color?: string;
  size?: string;
};

function describeUnavailable(product: UnavailableProduct): string {
  const variant = [product.color, product.size]
    .filter(Boolean)
    .join(" / ");

  return variant
    ? `${product.productName} (${variant})`
    : product.productName;
}

/**
 * Thrown by placeOrder() when one or more products do not have enough
 * stock. When this is thrown, NO order exists and inventory is unchanged.
 * The checkout API maps it to HTTP 409 Conflict.
 */
export class InsufficientInventoryError extends Error {
  readonly products: UnavailableProduct[];

  constructor(products: UnavailableProduct[]) {
    const names = products
      .map(describeUnavailable)
      .join(", ");

    super(
      `Some products are no longer available in the requested quantity: ${names}.`
    );

    this.name = "InsufficientInventoryError";
    this.products = products;
  }
}

/**
 * Atomically takes stock for one request:
 *
 *   per product:  inventory -= q            WHERE inventory >= q
 *   per variant:  variantStock[key] -= q,
 *                 inventory -= q            WHERE variantStock[key] >= q
 *                                             AND inventory >= q
 *
 * Returns true when the document was updated (stock reserved).
 * Returns false when the product/variant is missing or has too little
 * stock (nothing is changed in that case).
 */
export async function atomicDecrementInventory(
  item: InventoryRequest,
  session?: ClientSession
): Promise<boolean> {
  const collection = await getProductsCollection();
  const quantity = item.quantity;

  const result = item.variant
    ? await collection.updateOne(
        {
          id: item.productId,
          [`variantStock.${item.variant}`]: { $gte: quantity },
          inventory: { $gte: quantity },
        },
        {
          $inc: {
            [`variantStock.${item.variant}`]: -quantity,
            inventory: -quantity,
          },
        },
        { session }
      )
    : await collection.updateOne(
        {
          id: item.productId,
          inventory: { $gte: quantity },
        },
        {
          $inc: { inventory: -quantity },
        },
        { session }
      );

  return result.modifiedCount === 1;
}

/**
 * Puts stock back. Used by placeOrder()'s fallback path for MongoDB
 * servers without transaction support, and by restockLines() (returns).
 */
export async function restoreInventory(
  items: InventoryRequest[]
): Promise<void> {
  const collection = await getProductsCollection();

  for (const item of items) {
    try {
      await collection.updateOne(
        { id: item.productId },
        {
          $inc: item.variant
            ? {
                [`variantStock.${item.variant}`]: item.quantity,
                inventory: item.quantity,
              }
            : { inventory: item.quantity },
        }
      );
    } catch (error) {
      console.error(
        `[INVENTORY] Could not restore ${item.quantity} unit(s) of product ${item.productId}${item.variant ? ` (${item.variant})` : ""}. Correct this product's stock manually.`,
        error
      );
    }
  }
}

/**
 * Turns order lines into stock requests:
 *   - products that track stock per size & colour → one request per
 *     size/colour (two lines of the same variant are combined)
 *   - other products → one request per product (all its lines combined)
 */
export async function buildInventoryRequests(
  lines: OrderLine[]
): Promise<InventoryRequest[]> {
  for (const line of lines) {
    if (
      !Number.isInteger(line.quantity) ||
      line.quantity < 1
    ) {
      throw new Error(
        `Invalid quantity for ${line.productName}.`
      );
    }
  }

  const collection = await getProductsCollection();
  const ids = [...new Set(lines.map((line) => line.productId))];
  const products = await collection
    .find(
      { id: { $in: ids } },
      { projection: { _id: 0, id: 1, variantStock: 1 } }
    )
    .toArray();

  const tracksVariants = new Map(
    products.map((product) => [
      product.id,
      hasVariantStock(product),
    ])
  );

  const grouped = new Map<string, InventoryRequest>();

  for (const line of lines) {
    const variant = tracksVariants.get(line.productId)
      ? variantKey(line.color, line.size)
      : null;

    const groupKey = variant
      ? `${line.productId}::${variant}`
      : line.productId;

    const existing = grouped.get(groupKey);

    if (existing) {
      existing.quantity += line.quantity;
    } else {
      grouped.set(groupKey, {
        productId: line.productId,
        productName: line.productName,
        quantity: line.quantity,
        variant,
        color: variant ? line.color : "",
        size: variant ? line.size : "",
      });
    }
  }

  return [...grouped.values()];
}

export function toUnavailable(item: InventoryRequest): UnavailableProduct {
  return {
    productId: item.productId,
    productName: item.productName,
    ...(item.variant
      ? { color: item.color, size: item.size }
      : {}),
  };
}

/**
 * Adds the given order lines back to stock (used when the admin marks a
 * return as received). Products that no longer exist are skipped.
 * Returns the ids of products whose stock went up.
 */
type StockLine = Pick<
  OrderLine,
  "productId" | "productName" | "color" | "size" | "quantity"
>;

/** Stock lines → inventory requests (per product, or per size & colour). */
function stockLinesToRequests(
  lines: StockLine[]
): Promise<InventoryRequest[]> {
  return buildInventoryRequests(
    lines.map((line, index) => ({
      lineId: String(index),
      productId: line.productId,
      productName: line.productName,
      slug: "",
      image: "",
      size: line.size,
      color: line.color,
      quantity: line.quantity,
      price: 0,
    }))
  );
}

export async function restockLines(
  lines: StockLine[]
): Promise<string[]> {
  const valid = lines.filter(
    (line) =>
      Number.isInteger(line.quantity) && line.quantity > 0
  );

  if (valid.length === 0) return [];

  const requests = await stockLinesToRequests(valid);

  await restoreInventory(requests);

  return [...new Set(requests.map((request) => request.productId))];
}

/** Internal: commit() said no, so the stock step is rolled back. */
class StockCommitDeclined extends Error {}

/**
 * Takes the REPLACEMENT items of an exchange out of stock, using the same
 * atomic per-product / per-size-&-colour decrement as placeOrder(), and
 * records the change through `commit` in the SAME all-or-nothing step:
 *
 *   take stock for every line (conditional, never below 0)
 *   any line short            → nothing taken → InsufficientInventoryError
 *   commit(session) → false   → nothing taken → returns false
 *   commit(session) → true    → stock taken + change saved → returns true
 *
 * `commit` must do its write with the given session (replica set / Atlas,
 * where this runs in a transaction). Without transaction support, taken
 * stock is put back if commit returns false or throws.
 */
export async function takeStockForExchange(
  lines: StockLine[],
  commit: (session?: ClientSession) => Promise<boolean>
): Promise<boolean> {
  const valid = lines.filter(
    (line) =>
      Number.isInteger(line.quantity) && line.quantity > 0
  );

  if (valid.length === 0) {
    return commit();
  }

  const items = await stockLinesToRequests(valid);

  /* ---------------- Replica set / Atlas: real transaction ---------------- */

  if (await supportsTransactions()) {
    const client = await clientPromise;
    const session = client.startSession();

    try {
      await session.withTransaction(async () => {
        const unavailable: UnavailableProduct[] = [];

        for (const item of items) {
          if (!(await atomicDecrementInventory(item, session))) {
            unavailable.push(toUnavailable(item));
          }
        }

        if (unavailable.length > 0) {
          throw new InsufficientInventoryError(unavailable);
        }

        if (!(await commit(session))) {
          throw new StockCommitDeclined();
        }
      });

      return true;
    } catch (error) {
      if (error instanceof StockCommitDeclined) return false;
      throw error;
    } finally {
      await session.endSession();
    }
  }

  /* ------------- Standalone mongod: compensating rollback ------------- */

  const taken: InventoryRequest[] = [];

  try {
    const unavailable: UnavailableProduct[] = [];

    for (const item of items) {
      if (await atomicDecrementInventory(item)) {
        taken.push(item);
      } else {
        unavailable.push(toUnavailable(item));
      }
    }

    if (unavailable.length > 0) {
      throw new InsufficientInventoryError(unavailable);
    }

    if (!(await commit())) {
      await restoreInventory(taken);
      return false;
    }

    return true;
  } catch (error) {
    await restoreInventory(taken);
    throw error;
  }
}
