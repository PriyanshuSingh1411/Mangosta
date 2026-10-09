import { NextRequest, NextResponse, after } from "next/server";
import { isAuthenticated } from "@/app/lib/adminAuth";
import {
  cancelProcessingOrder,
  cancelReturnedOrder,
  getOrderById,
  getOrders,
  ORDER_STATUSES,
  OrderStatusError,
  updateOrderStatus,
} from "@/app/lib/dataStore";
import type { OrderStatus } from "@/app/lib/dataStore";
import { canChangeOrderStatus } from "@/app/data/storeTypes";
import { emailForStatusChange, sendOrderStatusEmail } from "@/app/lib/orderEmails";
import { notifyBackInStock } from "@/app/lib/stockAlerts";

/**
 * PATCH /api/admin/orders/:id
 *   { status }                              pending | shipped | delivered | cancelled
 *   { status: "shipped", shipment: { courier, trackingNumber, trackingUrl } }
 *
 * Only allowed steps (see ORDER_STATUS_STEPS):
 *   Processing → Shipped | Cancelled;  Shipped → Delivered | Cancelled (RTO)
 * Emails the customer when the order ships (or its tracking changes), is
 * delivered or is cancelled. Cancelling (before shipping, or after it came
 * back to us) puts the stock back and gives the coupon use back.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const body = await req.json().catch(() => null);

  if (!body || !ORDER_STATUSES.includes(body.status as OrderStatus)) {
    return NextResponse.json(
      { error: `status must be one of: ${ORDER_STATUSES.join(", ")}` },
      { status: 400 }
    );
  }

  const status = body.status as OrderStatus;
  let shipment: { courier: string; trackingNumber: string; trackingUrl: string } | undefined;

  if (body.shipment && typeof body.shipment === "object") {
    const trackingUrl = String(body.shipment.trackingUrl ?? "").trim().slice(0, 500);

    if (trackingUrl && !/^https?:\/\//i.test(trackingUrl)) {
      return NextResponse.json(
        { error: "Tracking link must start with http:// or https://" },
        { status: 400 }
      );
    }

    shipment = {
      courier: String(body.shipment.courier ?? "").slice(0, 80),
      trackingNumber: String(body.shipment.trackingNumber ?? "").slice(0, 80),
      trackingUrl,
    };
  }

  const before = await getOrderById(id);
  if (!before) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Cancelling (before it ships, or after it came back to us): stock goes
  // back (once), the coupon use is given back, and waiting customers hear
  // that the size is available again.
  if (
    status === "cancelled" &&
    (before.status === "pending" || before.status === "shipped") &&
    canChangeOrderStatus(before.status, status)
  ) {
    const result =
      before.status === "pending"
        ? await cancelProcessingOrder(id, { by: "admin" })
        : await cancelReturnedOrder(id);

    if (!result) {
      return NextResponse.json(
        { error: "This order was just changed. Refresh the page and try again." },
        { status: 409 }
      );
    }

    after(async () => {
      await notifyBackInStock(result.restockedProductIds);
      await sendOrderStatusEmail(result.order, "cancelled");
    });

    return NextResponse.json({ orders: await getOrders() });
  }

  let orders;
  try {
    orders = await updateOrderStatus(id, status, shipment);
  } catch (error) {
    if (error instanceof OrderStatusError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    throw error;
  }

  const updated = orders.find((order) => order.id === id);
  const kind = updated ? emailForStatusChange(before, updated) : null;
  if (updated && kind) {
    after(() => sendOrderStatusEmail(updated, kind));
  }

  return NextResponse.json({ orders });
}
