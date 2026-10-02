import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/app/lib/adminAuth";
import {
  getProducts,
  getProduct,
  updateProduct,
  deleteProduct,
  slugify,
} from "@/app/lib/dataStore";
import type { ProductEditableFields } from "@/app/lib/dataStore";
import type { Product } from "@/app/data/productTypes";
import { validateProductPricing, validateInventoryValue } from "@/app/lib/priceValidation";

/**
 * "No value" for an optional field. The admin form omits empty fields, and
 * MongoDB stores undefined fields as null, so all three mean "not set".
 */
function isBlank(value: unknown): boolean {
  return value === undefined || value === null || value === "";
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const product = await getProduct(id);
  if (!product) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(product);
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const existingProduct = await getProduct(id);
  if (!existingProduct) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => null);
  if (!body || typeof body.name !== "string" || !body.name.trim()) {
    return NextResponse.json({ error: "Product name is required." }, { status: 400 });
  }

  const allProducts = await getProducts();

  /* ------------------------------------------------------------------ */
  /* Pricing                                                            */
  /* ------------------------------------------------------------------ */

  const price = isBlank(body.price) ? existingProduct.price : Number(body.price);
  if (!Number.isFinite(price) || price < 0) {
    return NextResponse.json({ error: "Price must be a valid positive number." }, { status: 400 });
  }

  // Blank discount keeps the saved discount (enter 0 to remove it).
  const discountPercent = isBlank(body.discountPercent)
    ? existingProduct.discountPercent ?? undefined
    : Number(body.discountPercent);
  if (discountPercent !== undefined && (!Number.isFinite(discountPercent) || discountPercent < 0 || discountPercent > 100)) {
    return NextResponse.json({ error: "Discount percent must be between 0 and 100." }, { status: 400 });
  }

  // Blank compare-at price removes it.
  const compareAtPrice = isBlank(body.compareAtPrice) ? undefined : Number(body.compareAtPrice);
  if (compareAtPrice !== undefined && (!Number.isFinite(compareAtPrice) || compareAtPrice < 0)) {
    return NextResponse.json({ error: "compareAtPrice must be a valid positive number." }, { status: 400 });
  }

  /* ------------------------------------------------------------------ */
  /* Stock                                                              */
  /*                                                                    */
  /* The form sends the stock value it loaded (inventoryOnLoad) and the */
  /* value in the field (inventory).                                    */
  /*   same      → admin did not touch stock → stock is NOT written,    */
  /*               so sales made while the form was open are kept.      */
  /*   different → admin entered new stock → written only if the       */
  /*               database still holds inventoryOnLoad (no sales       */
  /*               since), otherwise 409 with the current stock.        */
  /* ------------------------------------------------------------------ */

  let stock: { expected: number; next: number } | undefined;

  if (!isBlank(body.inventory)) {
    const nextInventory = Number(body.inventory);
    const inventoryValidation = validateInventoryValue(nextInventory);
    if (!inventoryValidation.valid) {
      return NextResponse.json({ error: `Inventory: ${inventoryValidation.error}` }, { status: 400 });
    }

    if (isBlank(body.inventoryOnLoad)) {
      // Older form without inventoryOnLoad: only safe if nothing changed.
      if (nextInventory !== existingProduct.inventory) {
        return NextResponse.json(
          {
            error: `Stock for this product is now ${existingProduct.inventory}. Reload this page to edit the latest stock.`,
            currentInventory: existingProduct.inventory,
          },
          { status: 409 }
        );
      }
    } else {
      const inventoryOnLoad = Number(body.inventoryOnLoad);
      if (!validateInventoryValue(inventoryOnLoad).valid) {
        return NextResponse.json({ error: "Invalid inventoryOnLoad." }, { status: 400 });
      }
      if (nextInventory !== inventoryOnLoad) {
        stock = { expected: inventoryOnLoad, next: nextInventory };
      }
    }
  }

  /* ------------------------------------------------------------------ */
  /* Slug                                                               */
  /* ------------------------------------------------------------------ */

  // Re-slugify only if the name or an explicit slug changed, and keep it
  // unique against every other product (excluding itself).
  let slug = existingProduct.slug;
  const requestedSlug = slugify(body.slug || body.name);
  if (requestedSlug !== existingProduct.slug) {
    let candidate = requestedSlug;
    let n = 2;
    while (allProducts.some((p) => p.slug === candidate && p.id !== id)) {
      candidate = `${requestedSlug}-${n++}`;
    }
    slug = candidate;
  }

  const fields: ProductEditableFields = {
    slug,
    name: body.name.trim(),
    category: body.category || existingProduct.category,
    price,
    compareAtPrice,
    discountPercent,
    description: body.description ?? existingProduct.description,
    details: Array.isArray(body.details) ? body.details.filter(Boolean) : existingProduct.details,
    colors: Array.isArray(body.colors) ? body.colors : existingProduct.colors,
    sizes: Array.isArray(body.sizes) ? body.sizes.filter(Boolean) : existingProduct.sizes,
    images: Array.isArray(body.images) ? body.images.filter(Boolean) : existingProduct.images,
    dropLabel: body.dropLabel || undefined,
    isNew: Boolean(body.isNew),
  };

  // Validate the product as it will be after saving
  const candidate: Product = {
    ...existingProduct,
    ...fields,
    inventory: stock ? stock.next : existingProduct.inventory,
  };
  const pricingValidation = validateProductPricing(candidate);
  if (!pricingValidation.valid) {
    return NextResponse.json({ error: `Pricing validation failed: ${pricingValidation.errors.join("; ")}` }, { status: 400 });
  }

  const result = await updateProduct(id, fields, stock);

  if (result.status === "not_found") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (result.status === "stock_changed") {
    return NextResponse.json(
      {
        error: `Stock changed from ${stock?.expected} to ${result.currentInventory} since you opened this product (orders were placed). Nothing was saved. Check the stock value and save again.`,
        currentInventory: result.currentInventory,
      },
      { status: 409 }
    );
  }

  const products = await getProducts();
  return NextResponse.json({ product: result.product, products });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const product = await getProduct(id);
  if (!product) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const products = await deleteProduct(id);
  return NextResponse.json({ products });
}
