import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/app/lib/adminAuth";
import {
  getProducts,
  upsertProduct,
  generateProductId,
  slugify,
} from "@/app/lib/dataStore";
import type { Product } from "@/app/data/productTypes";
import { validateProductPricing, validateInventoryValue } from "@/app/lib/priceValidation";
import {
  sanitizeColorImages,
  sanitizeCompleteTheLook,
  sanitizeVariantStock,
  sumStock,
} from "@/app/lib/productInput";

export async function GET() {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const products = await getProducts();
  return NextResponse.json(products);
}

export async function POST(req: NextRequest) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body.name !== "string" || !body.name.trim()) {
    return NextResponse.json({ error: "Product name is required." }, { status: 400 });
  }

  const existing = await getProducts();

  const slugBase = slugify(body.slug || body.name);
  let slug = slugBase;
  let n = 2;
  while (existing.some((p) => p.slug === slug)) {
    slug = `${slugBase}-${n++}`;
  }

  // Parse and validate pricing fields
  const price = Number(body.price);
  if (!Number.isFinite(price) || price < 0) {
    return NextResponse.json({ error: "Price must be a valid positive number." }, { status: 400 });
  }

  const discountPercent = body.discountPercent ? Number(body.discountPercent) : undefined;
  if (discountPercent !== undefined && (!Number.isFinite(discountPercent) || discountPercent < 0 || discountPercent > 100)) {
    return NextResponse.json({ error: "Discount percent must be between 0 and 100." }, { status: 400 });
  }

  const compareAtPrice = body.compareAtPrice ? Number(body.compareAtPrice) : undefined;
  if (compareAtPrice !== undefined && (!Number.isFinite(compareAtPrice) || compareAtPrice < 0)) {
    return NextResponse.json({ error: "compareAtPrice must be a valid positive number." }, { status: 400 });
  }

  const colors = Array.isArray(body.colors) ? body.colors : [];
  const sizes = Array.isArray(body.sizes) ? body.sizes.filter(Boolean) : [];

  // Stock per size & colour (optional). When used, the total is its sum.
  let variantStock: Record<string, number> | undefined;
  if (body.stockMode === "variants") {
    const cleaned = sanitizeVariantStock(body.variantStock, colors, sizes);
    if (!cleaned) {
      return NextResponse.json({ error: "Stock per size & colour must be whole numbers of 0 or more." }, { status: 400 });
    }
    variantStock = cleaned;
  }

  const inventory = variantStock ? sumStock(variantStock) : Number(body.inventory || 0);
  const inventoryValidation = validateInventoryValue(inventory);
  if (!inventoryValidation.valid) {
    return NextResponse.json({ error: `Inventory: ${inventoryValidation.error}` }, { status: 400 });
  }

  const product: Product = {
    id: generateProductId(existing),
    slug,
    name: body.name.trim(),
    category: body.category || "t-shirts",
    price,
    compareAtPrice,
    discountPercent,
    currency: "INR",
    description: body.description || "",
    details: Array.isArray(body.details) ? body.details.filter(Boolean) : [],
    colors,
    sizes,
    images: Array.isArray(body.images) ? body.images.filter(Boolean) : [],
    dropLabel: body.dropLabel || undefined,
    isNew: Boolean(body.isNew),
    inventory,
    variantStock,
    colorImages: sanitizeColorImages(body.colorImages, colors),
    completeTheLook: sanitizeCompleteTheLook(body.completeTheLook, existing),
  };

  // MongoDB would store undefined optional fields as null — drop them.
  for (const key of ["variantStock", "colorImages", "completeTheLook", "compareAtPrice", "discountPercent", "dropLabel"] as const) {
    if (product[key] === undefined) delete product[key];
  }

  // Validate complete product pricing
  const pricingValidation = validateProductPricing(product);
  if (!pricingValidation.valid) {
    return NextResponse.json({ error: `Pricing validation failed: ${pricingValidation.errors.join("; ")}` }, { status: 400 });
  }

  const products = await upsertProduct(product);
  return NextResponse.json({ product, products }, { status: 201 });
}
