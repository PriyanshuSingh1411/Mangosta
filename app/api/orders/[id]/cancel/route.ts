import { NextRequest, NextResponse, after } from "next/server";
import { getCurrentUser } from "@/app/lib/auth/session";
import { cancelProcessingOrder, getCustomerOrder } from "@/app/lib/dataStore";
import { CANCEL_REASONS } from "@/app/data/storeTypes";
import { sendOrderStatusEmail, sendShopCancelAlert } from "@/app/lib/orderEmails";
import { notifyBackInStock } from "@/app/lib/stockAlerts";

/**
 * POST /api/orders/:id/cancel { reason? }
 * The signed-in customer cancels their own order while it is still
 * Processing. Stock goes back automatically; both sides get an email.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Please sign in to cancel this order." }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => null);
  const reason = CANCEL_REASONS.includes(String(body?.reason ?? "")) ? String(body.reason) : "";

  const order = await getCustomerOrder({ userId: user.id, email: user.email }, id);

  if (!order) {
    return NextResponse.json({ error: "Order not found." }, { status: 404 });
  }

  if (order.status === "cancelled") {
    return NextResponse.json({ error: "This order is already cancelled." }, { status: 409 });
  }
  if (order.status !== "pending") {
    return NextResponse.json(
      {
        error:
          order.status === "shipped"
            ? "This order has already shipped, so it can't be cancelled. You can request a return once it's delivered."
            : "This order has been delivered. You can request a return or exchange instead.",
      },
      { status: 409 }
    );
  }

  const result = await cancelProcessingOrder(id, { by: "customer", reason });
  if (!result) {
    // Shipped or cancelled a moment ago.
    return NextResponse.json(
      { error: "This order can no longer be cancelled. Please refresh the page." },
      { status: 409 }
    );
  }

  after(async () => {
    await notifyBackInStock(result.restockedProductIds);
    await sendOrderStatusEmail(result.order, "cancelled");
    await sendShopCancelAlert(result.order);
  });

  return NextResponse.json({ order: result.order });
}
