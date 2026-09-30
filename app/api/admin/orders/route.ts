import { NextResponse } from "next/server";
import { isAuthenticated } from "@/app/lib/adminAuth";
import { getOrders } from "@/app/lib/dataStore";

export async function GET() {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const orders = await getOrders();
  return NextResponse.json(orders);
}
