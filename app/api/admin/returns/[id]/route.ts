import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/app/lib/adminAuth";
import { ReturnRequestError, updateReturnRequest } from "@/app/lib/returns";
import { notifyBackInStock } from "@/app/lib/stockAlerts";
import type { ReturnRequestStatus } from "@/app/data/storeTypes";

const STATUSES: ReturnRequestStatus[] = ["requested", "approved", "rejected", "received", "completed"];

/** PATCH /api/admin/returns/:id { status?, adminNote?, restock? } */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const status = STATUSES.includes(body?.status) ? (body.status as ReturnRequestStatus) : undefined;

  try {
    const { request, restockedProductIds, stockChange } = await updateReturnRequest({
      id,
      status,
      adminNote: typeof body?.adminNote === "string" ? body.adminNote : undefined,
      restock: Boolean(body?.restock),
    });

    const alerts = await notifyBackInStock(restockedProductIds).catch(() => null);

    return NextResponse.json({ request, stockChange, alertsSent: alerts?.sent ?? 0 });
  } catch (error) {
    if (error instanceof ReturnRequestError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("PATCH /api/admin/returns error:", error);
    return NextResponse.json({ error: "Unable to update the request." }, { status: 500 });
  }
}
