import { NextResponse } from "next/server";
import { getProducts } from "@/app/lib/dataStore";
import { toPublicProduct } from "@/app/data/productTypes";

/**
 * GET /api/products
 *
 * Returns all products with server-validated prices.
 * Cache is explicitly disabled to ensure prices are always current.
 *
 * Response includes:
 * - All product data (name, description, images, etc.)
 * - Server-calculated sale prices (never trust client-side prices)
 * - Discount percentages and compareAtPrices
 * - Stock levels capped at PUBLIC_STOCK_CAP (exact stock stays private)
 */
export async function GET() {
  try {
    const products = await getProducts();

    // Validate all product data before returning
    const validatedProducts = products.map(toPublicProduct).map(product => ({
      ...product,
      // Ensure numeric fields are properly typed
      price: Math.max(0, Number(product.price) || 0),
      inventory: Math.max(0, Number(product.inventory) || 0),
      discountPercent: Math.min(100, Math.max(0, Number(product.discountPercent) || 0)),
      ...(product.compareAtPrice && {
        compareAtPrice: Math.max(0, Number(product.compareAtPrice) || 0),
      }),
    }));

    return NextResponse.json(validatedProducts, {
      status: 200,
      headers: {
        "Cache-Control": "no-store, max-age=0, must-revalidate",
        "Pragma": "no-cache",
        "Expires": "0",
        // Set ETag for cache validation on client
        "ETag": `"products-${Date.now()}"`,
      },
    });
  } catch (error) {
    console.error("GET /api/products error:", error);

    return NextResponse.json(
      { error: "Failed to load products" },
      {
        status: 500,
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  }
}
