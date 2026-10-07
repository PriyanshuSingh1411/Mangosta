import { NextResponse } from "next/server";
import { getCurrentUser } from "@/app/lib/auth/session";
import { getReviewedProductIds } from "@/app/lib/reviews";

export const dynamic = "force-dynamic";

/** GET /api/reviews/mine → ids of products the signed-in customer has reviewed. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  }
  return NextResponse.json(
    { productIds: await getReviewedProductIds(user.id) },
    { headers: { "Cache-Control": "no-store" } }
  );
}
