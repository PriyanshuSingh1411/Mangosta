import { NextResponse } from "next/server";
import { getStoreConfig } from "@/app/lib/storeConfig";

export const dynamic = "force-dynamic";

/** GET /api/size-guide → the size charts set in Admin → Size Guide. */
export async function GET() {
  return NextResponse.json(await getStoreConfig("sizeGuide"), {
    headers: { "Cache-Control": "no-store" },
  });
}
