import { NextRequest, NextResponse } from "next/server";
import { getStoreConfig } from "@/app/lib/storeConfig";
import { checkPincode } from "@/app/data/storeTypes";

export const dynamic = "force-dynamic";

/** GET /api/delivery/check?pincode=400001 → delivery estimate + COD. */
export async function GET(req: NextRequest) {
  const config = await getStoreConfig("delivery");
  const pincode = req.nextUrl.searchParams.get("pincode") ?? "";

  return NextResponse.json(
    { enabled: config.enabled, ...checkPincode(config, pincode) },
    { headers: { "Cache-Control": "no-store" } }
  );
}
