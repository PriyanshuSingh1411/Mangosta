import { NextResponse } from "next/server";
import { getProducts } from "@/app/lib/dataStore";

export async function GET() {
  const products = await getProducts();
  return NextResponse.json(products, {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
