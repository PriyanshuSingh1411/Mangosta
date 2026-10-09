import { NextResponse } from "next/server";
import { getCurrentUser } from "@/app/lib/auth/session";
import { getCustomerOrder } from "@/app/lib/dataStore";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

/** GET /api/orders/:id → one of the signed-in customer's orders. */
export async function GET(_request: Request, { params }: RouteContext) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { error: "Order ID is required." },
        { status: 400 }
      );
    }

    const user = await getCurrentUser();

    if (!user?.email) {
      return NextResponse.json(
        { error: "Please sign in to view this order." },
        { status: 401 }
      );
    }

    // Someone else's order answers exactly like a missing one.
    const order = await getCustomerOrder({ userId: user.id, email: user.email }, id);

    if (!order) {
      return NextResponse.json(
        { error: "Order not found." },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { order },
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("GET /api/orders/[id] error:", error);

    return NextResponse.json(
      { error: "Unable to load order." },
      { status: 500 }
    );
  }
}
