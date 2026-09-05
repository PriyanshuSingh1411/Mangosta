import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/app/lib/adminAuth";
import { getProducts, getProduct, upsertProduct, deleteProduct, slugify } from "@/app/lib/dataStore";

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

  const updated = {
    ...existingProduct,
    slug,
    name: body.name.trim(),
    category: body.category || existingProduct.category,
    price: Number(body.price) || 0,
    compareAtPrice:
      body.compareAtPrice !== undefined && body.compareAtPrice !== null && body.compareAtPrice !== ""
        ? Number(body.compareAtPrice)
        : undefined,
    description: body.description ?? existingProduct.description,
    details: Array.isArray(body.details) ? body.details.filter(Boolean) : existingProduct.details,
    colors: Array.isArray(body.colors) ? body.colors : existingProduct.colors,
    sizes: Array.isArray(body.sizes) ? body.sizes.filter(Boolean) : existingProduct.sizes,
    images: Array.isArray(body.images) ? body.images.filter(Boolean) : existingProduct.images,
    dropLabel: body.dropLabel || undefined,
    isNew: Boolean(body.isNew),
    inventory: Number.isFinite(Number(body.inventory))
      ? Number(body.inventory)
      : existingProduct.inventory,
  };

  const products = await upsertProduct(updated);
  return NextResponse.json({ product: updated, products });
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
