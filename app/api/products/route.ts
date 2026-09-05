import { NextResponse } from "next/server";
import { getProducts } from "@/app/lib/dataStore";

export async function GET() {
  const products = await getProducts();
  return NextResponse.json(products, {
    headers: {
      // Short cache: admin edits should show up on the storefront quickly,
      // but we don't want every card re-fetching on every render either.
      "Cache-Control": "public, max-age=5, stale-while-revalidate=30",
    },
  });
}
