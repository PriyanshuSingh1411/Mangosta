import { NextResponse } from "next/server";
import { getCurrentUser } from "@/app/lib/auth/session";
import { getOrdersForCustomer } from "@/app/lib/dataStore";

export const dynamic = "force-dynamic";

/**
 * GET /api/orders → the signed-in customer's orders, newest first
 * (placed by their account or with their account email).
 */
export async function GET() {
  try {
    const user = await getCurrentUser();

    if (!user?.email) {
      return NextResponse.json(
        { error: "Please sign in to view your orders." },
        { status: 401 }
      );
    }

    const orders = await getOrdersForCustomer({
      userId: user.id,
      email: user.email,
    });

    return NextResponse.json(
      { orders },
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("GET /api/orders error:", error);

    return NextResponse.json(
      { error: "Unable to load orders." },
      { status: 500 }
    );
  }
}
