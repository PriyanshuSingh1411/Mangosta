import { NextResponse } from "next/server";

import { isAuthenticated } from "@/app/lib/adminAuth";
import { getOrders } from "@/app/lib/dataStore";

export async function GET() {
  if (!(await isAuthenticated())) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const orders = await getOrders();

    return NextResponse.json(orders);
  } catch (error) {
    console.error("[admin/orders] Failed to load orders:", error);

    return NextResponse.json(
      { error: "Failed to load orders." },
      { status: 500 }
    );
  }
}