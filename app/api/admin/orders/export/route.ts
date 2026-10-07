import { NextResponse } from "next/server";
import { isAuthenticated } from "@/app/lib/adminAuth";
import { getOrders } from "@/app/lib/dataStore";

export const dynamic = "force-dynamic";

function cell(value: unknown): string {
  const text = String(value ?? "");
  // Stop spreadsheet formulas from running ("=SUM(...)" typed as a name).
  const safe = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/**
 * GET /api/admin/orders/export → orders as a CSV file that opens directly
 * in Excel / Google Sheets (one row per order item).
 */
export async function GET() {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const orders = await getOrders();
  const header = [
    "Order ID", "Date", "Status", "Payment method", "Payment status",
    "Customer", "Email", "Mobile", "Address", "City", "State", "PIN code",
    "Product", "Colour", "Size", "Quantity", "Unit price", "Line total",
    "Order subtotal", "Discount", "Coupon", "Shipping", "Order total",
    "Courier", "Tracking number", "Shipped at", "Delivered at",
  ];

  const rows: string[] = [header.map(cell).join(",")];

  for (const order of orders) {
    const lines = order.lines.length > 0 ? order.lines : [null];
    lines.forEach((line, index) => {
      const first = index === 0;
      rows.push(
        [
          order.id,
          new Date(order.createdAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }),
          order.status,
          order.paymentMethod,
          order.paymentStatus,
          `${order.customer.firstName} ${order.customer.lastName}`.trim(),
          order.customer.email,
          order.customer.mobile,
          order.customer.address,
          order.customer.city,
          order.customer.state,
          order.customer.postalCode,
          line?.productName ?? "",
          line?.color ?? "",
          line?.size ?? "",
          line?.quantity ?? "",
          line ? line.price.toFixed(2) : "",
          line ? (line.price * line.quantity).toFixed(2) : "",
          first ? order.subtotal.toFixed(2) : "",
          first ? (order.discount ?? 0).toFixed(2) : "",
          first ? order.couponCode ?? "" : "",
          first ? order.shipping.toFixed(2) : "",
          first ? order.total.toFixed(2) : "",
          order.shipment?.courier ?? "",
          order.shipment?.trackingNumber ?? "",
          order.shipment?.shippedAt ? new Date(order.shipment.shippedAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }) : "",
          order.deliveredAt ? new Date(order.deliveredAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }) : "",
        ]
          .map(cell)
          .join(",")
      );
    });
  }

  const date = new Date().toISOString().slice(0, 10);
  // Leading BOM so Excel reads ₹ and other characters correctly.
  return new NextResponse("﻿" + rows.join("\r\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="mangosta-orders-${date}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
