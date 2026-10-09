import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/app/lib/auth/session";
import { getStoreConfig } from "@/app/lib/storeConfig";
import {
  createReturnRequest,
  getReturnsForEmail,
  ReturnRequestError,
} from "@/app/lib/returns";

export const dynamic = "force-dynamic";

/** GET /api/returns → the signed-in customer's requests + the return policy. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  }

  const [requests, policy] = await Promise.all([
    getReturnsForEmail(user.email),
    getStoreConfig("returnsPolicy"),
  ]);

  return NextResponse.json({ requests, policy }, { headers: { "Cache-Control": "no-store" } });
}

/** POST /api/returns { orderId, type, reason, note, items[] } */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  }

  const body = await req.json().catch(() => null);

  try {
    const request = await createReturnRequest({
      email: user.email,
      userId: user.id,
      orderId: String(body?.orderId ?? ""),
      type: body?.type === "exchange" ? "exchange" : "return",
      reason: String(body?.reason ?? ""),
      note: String(body?.note ?? ""),
      items: (Array.isArray(body?.items) ? body.items : []).map((item: Record<string, unknown>) => ({
        lineId: String(item?.lineId ?? ""),
        quantity: Number(item?.quantity),
        exchangeSize: item?.exchangeSize ? String(item.exchangeSize) : undefined,
        exchangeColor: item?.exchangeColor ? String(item.exchangeColor) : undefined,
      })),
    });

    return NextResponse.json({ request }, { status: 201 });
  } catch (error) {
    if (error instanceof ReturnRequestError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("POST /api/returns error:", error);
    return NextResponse.json({ error: "Unable to submit the request." }, { status: 500 });
  }
}
