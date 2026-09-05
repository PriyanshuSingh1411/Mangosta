import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/app/lib/adminAuth";
import { updateOrderStatus, getOrders } from "@/app/lib/dataStore";

const VALID_STATUSES = ["pending", "fulfilled", "cancelled"];

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const body = await req.json().catch(() => null);

  if (!body || !VALID_STATUSES.includes(body.status)) {
    return NextResponse.json(
      { error: `status must be one of: ${VALID_STATUSES.join(", ")}` },
      { status: 400 }
    );
  }

  const existing = await getOrders();
  if (!existing.some((o) => o.id === id)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const orders = await updateOrderStatus(id, body.status);
  return NextResponse.json({ orders });
}
