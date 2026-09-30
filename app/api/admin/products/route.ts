import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/app/lib/adminAuth";
import {
  getProducts,
  upsertProduct,
  generateProductId,
  slugify,
} from "@/app/lib/dataStore";
import type { Product } from "@/app/data/productTypes";

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

  const product: Product = {
    id: generateProductId(existing),
    slug,
    name: body.name.trim(),
    category: body.category || "t-shirts",
    price: Number(body.price) || 0,
    compareAtPrice: body.compareAtPrice ? Number(body.compareAtPrice) : undefined,
    currency: "INR",
    description: body.description || "",
    details: Array.isArray(body.details) ? body.details.filter(Boolean) : [],
    colors: Array.isArray(body.colors) ? body.colors : [],
    sizes: Array.isArray(body.sizes) ? body.sizes.filter(Boolean) : [],
    images: Array.isArray(body.images) ? body.images.filter(Boolean) : [],
    dropLabel: body.dropLabel || undefined,
    isNew: Boolean(body.isNew),
    inventory: Number.isFinite(Number(body.inventory)) ? Number(body.inventory) : 0,
  };

  const products = await upsertProduct(product);
  return NextResponse.json({ product, products }, { status: 201 });
}
