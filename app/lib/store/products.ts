import "server-only";

import type { Product } from "@/app/data/productTypes";
import { PRODUCTS_PATH, getDb, isMigrated, markMigrated, readJson } from "./core";

// Products: reading, saving and deleting (stock changes live in inventory.ts).

// ============================================================
// PRODUCTS
// ============================================================

export async function getProductsCollection() {
  const db = await getDb();
  return db.collection<Product>("products");
}

async function migrateProductsFromJson(): Promise<void> {
  const migrationId = "products-json-to-mongodb";
  if (await isMigrated(migrationId)) {
    return;
  }

  const collection = await getProductsCollection();

  // Do not duplicate products if the collection already has data.
  if ((await collection.countDocuments()) === 0) {
    const products = await readJson<Product[]>(
      PRODUCTS_PATH,
      []
    );

    if (products.length > 0) {
      await collection.insertMany(products);
    }
  }

  await markMigrated(migrationId);
}

export async function getProducts(): Promise<Product[]> {
  await migrateProductsFromJson();

  const collection = await getProductsCollection();
  return collection
    .find({}, { projection: { _id: 0 } })
    .sort({ id: 1 })
    .toArray();
}

export async function getProduct(
  id: string
): Promise<Product | undefined> {
  const collection = await getProductsCollection();

  const product = await collection.findOne(
    { id },
    { projection: { _id: 0 } }
  );

  return product ?? undefined;
}

export async function upsertProduct(
  product: Product
): Promise<Product[]> {
  const collection = await getProductsCollection();

  await collection.replaceOne(
    { id: product.id },
    product,
    { upsert: true }
  );

  return collection
    .find({}, { projection: { _id: 0 } })
    .sort({ id: 1 })
    .toArray();
}

/**
 * Product fields the admin edit form can change. Stock (inventory and
 * variantStock) is written separately through `ProductStockUpdate`.
 */
export type ProductEditableFields = Omit<
  Product,
  "id" | "currency" | "inventory" | "variantStock"
>;

/**
 * A stock change typed by the admin.
 *   expected      inventory the form loaded (every sale lowers inventory,
 *                 so a mismatch means orders were placed meanwhile)
 *   next          new total stock
 *   variantStock  undefined = leave per-size stock as it is
 *                 null      = stop tracking per size & colour
 *                 object    = new stock per size & colour (next = its sum)
 */
export type ProductStockUpdate = {
  expected: number;
  next: number;
  variantStock?: Record<string, number> | null;
};

export type UpdateProductResult =
  | { status: "updated"; product: Product }
  | { status: "not_found" }
  | {
      status: "stock_changed";
      currentInventory: number;
      currentVariantStock?: Record<string, number>;
    };

/**
 * Updates an existing product in place (used by the admin edit form).
 *
 * Stock is never overwritten by accident:
 * - `stock` omitted → inventory is not written at all, so sales made while
 *   the admin had the form open are kept.
 * - `stock` given → the admin typed a new stock value. It is written only
 *   if the product's inventory is still `stock.expected` (the value the
 *   form loaded). If orders changed it meanwhile, nothing is saved and
 *   "stock_changed" is returned with the current value.
 *
 * Fields set to undefined are removed ($unset) rather than stored as null.
 */
export async function updateProduct(
  id: string,
  fields: ProductEditableFields,
  stock?: ProductStockUpdate
): Promise<UpdateProductResult> {
  const collection = await getProductsCollection();

  const $set: Record<string, unknown> = {};
  const $unset: Record<string, ""> = {};

  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined) {
      $unset[key] = "";
    } else {
      $set[key] = value;
    }
  }

  if (stock) {
    $set.inventory = stock.next;

    if (stock.variantStock === null) {
      $unset.variantStock = "";
    } else if (stock.variantStock) {
      $set.variantStock = stock.variantStock;
    }
  }

  const result = await collection.updateOne(
    stock
      ? { id, inventory: stock.expected }
      : { id },
    Object.keys($unset).length > 0
      ? { $set, $unset }
      : { $set }
  );

  const current = await getProduct(id);

  if (!current) {
    return { status: "not_found" };
  }

  if (result.matchedCount === 0) {
    return {
      status: "stock_changed",
      currentInventory: current.inventory,
      currentVariantStock: current.variantStock,
    };
  }

  return { status: "updated", product: current };
}

export async function deleteProduct(
  id: string
): Promise<Product[]> {
  const collection = await getProductsCollection();

  await collection.deleteOne({ id });

  return collection
    .find({}, { projection: { _id: 0 } })
    .sort({ id: 1 })
    .toArray();
}

export function generateProductId(
  existing: Product[]
): string {
  const nums = existing
    .map((product) =>
      parseInt(
        product.id.replace(/^p-/, ""),
        10
      )
    )
    .filter((number) => !Number.isNaN(number));

  const max =
    nums.length > 0
      ? Math.max(...nums)
      : 0;

  return `p-${String(max + 1).padStart(3, "0")}`;
}
