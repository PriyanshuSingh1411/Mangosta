import { NextRequest, NextResponse } from "next/server";
import { getProduct } from "@/app/lib/dataStore";
import { createStockAlert, isValidEmail } from "@/app/lib/stockAlerts";
import { getProductSizes, isVariantAvailable } from "@/app/data/productTypes";

/**
 * POST /api/stock-alerts { productId, color, size, email }
 * "Notify me when back in stock" — works for guests too.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const productId = String(body?.productId ?? "");
  const color = String(body?.color ?? "").slice(0, 60);
  const size = String(body?.size ?? "").slice(0, 20);
  const email = String(body?.email ?? "").trim().toLowerCase().slice(0, 200);

  if (!isValidEmail(email)) {
    return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
  }

  const product = await getProduct(productId);
  if (!product) {
    return NextResponse.json({ error: "Product not found." }, { status: 404 });
  }

  const colorOk = product.colors.length === 0 ? color === "" : product.colors.some((c) => c.name === color);
  if (!colorOk || !getProductSizes(product).includes(size)) {
    return NextResponse.json({ error: "Please choose a colour and size." }, { status: 400 });
  }

  if (isVariantAvailable(product, color, size)) {
    return NextResponse.json({ error: "Good news — this size is in stock right now." }, { status: 409 });
  }

  const created = await createStockAlert({ productId, color, size, email });

  return NextResponse.json({ ok: true, alreadyWaiting: !created });
}
