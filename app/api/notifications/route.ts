import { NextResponse } from "next/server";
import { getCurrentUser } from "@/app/lib/auth/session";
import { getOrders } from "@/app/lib/dataStore";
import { getProducts } from "@/app/lib/dataStore";
import { getReviewedProductIds } from "@/app/lib/reviews";
import { getWishlistItems, updateWishlistInventorySnapshot } from "@/app/lib/wishlist";
import { getCustomerTickets } from "@/app/lib/support";
import { getProductSalePrice } from "@/app/data/productTypes";

export const dynamic = "force-dynamic";

export type Notification = {
  id: string;
  type: "wishlist" | "order" | "review" | "support";
  title: string;
  body: string;
  href: string;
  createdAt: string;
  priority: "high" | "normal";
};

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ notifications: [] }, { status: 200 });

  const [wishlist, orders, reviewedIds, products, tickets] = await Promise.all([
    getWishlistItems(user.id),
    getOrders(),
    getReviewedProductIds(user.id),
    getProducts(),
    getCustomerTickets(user.id),
  ]);

  const notifications: Notification[] = [];
  const productMap = new Map(products.map((product) => [product.id, product]));

  for (const item of wishlist) {
    const product = productMap.get(item.productId);
    if (!product) continue;

    const currentPrice = getProductSalePrice(product);
    const currentStock = Math.max(0, Number(product.inventory) || 0);

    if (item.priceAtSave > 0 && currentPrice < item.priceAtSave) {
      notifications.push({
        id: `price-${item.productId}-${currentPrice}`,
        type: "wishlist",
        title: `${product.name} dropped in price`,
        body: `Now ${new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(currentPrice)} — it was lower on your wishlist snapshot.`,
        href: `/product/${product.slug}`,
        createdAt: item.addedAt,
        priority: "high",
      });
    }

    if (item.inventoryAtSave <= 0 && currentStock > 0) {
      notifications.push({
        id: `stock-${item.productId}-${currentStock}`,
        type: "wishlist",
        title: `${product.name} is back in stock`,
        body: "The piece you saved is available again.",
        href: `/product/${product.slug}`,
        createdAt: new Date().toISOString(),
        priority: "high",
      });
    }

    if (currentStock > 0 && currentStock <= 2) {
      notifications.push({
        id: `low-${item.productId}-${currentStock}`,
        type: "wishlist",
        title: `${product.name} is almost sold out`,
        body: `Only ${currentStock} ${currentStock === 1 ? "unit" : "units"} left.`,
        href: `/product/${product.slug}`,
        createdAt: new Date().toISOString(),
        priority: "high",
      });
    }

    await updateWishlistInventorySnapshot(user.id, item.productId, currentStock);
  }

  const customerEmail = user.email.trim().toLowerCase();
  const customerOrders = orders.filter((order) => order.customer.email.trim().toLowerCase() === customerEmail).slice(0, 12);
  for (const order of customerOrders) {
    if (order.status === "shipped") {
      notifications.push({
        id: `order-shipped-${order.id}-${order.shipment?.trackingNumber || ""}`,
        type: "order",
        title: `Order ${order.id} has shipped`,
        body: order.shipment?.trackingNumber ? `Tracking: ${order.shipment.trackingNumber}` : "Your order is on the way.",
        href: `/orders/${order.id}`,
        createdAt: order.shipment?.shippedAt || order.createdAt,
        priority: "normal",
      });
    }
    if (order.status === "delivered") {
      notifications.push({
        id: `order-delivered-${order.id}`,
        type: "order",
        title: `Order ${order.id} was delivered`,
        body: "Hope you love your Mangosta pieces.",
        href: `/orders/${order.id}`,
        createdAt: order.deliveredAt || order.createdAt,
        priority: "normal",
      });

      const pendingReview = order.lines.find((line) => !reviewedIds.includes(line.productId));
      if (pendingReview) {
        notifications.push({
          id: `review-${order.id}-${pendingReview.productId}`,
          type: "review",
          title: "You can now review your order",
          body: `Tell us what you think about ${pendingReview.productName}.`,
          href: `/orders/${order.id}`,
          createdAt: order.deliveredAt || order.createdAt,
          priority: "normal",
        });
      }
    }
  }

  for (const ticket of tickets.slice(0, 5)) {
    if (ticket.status !== "resolved") {
      notifications.push({
        id: `support-${ticket.id}-${ticket.updatedAt}`,
        type: "support",
        title: `Support ticket ${ticket.id} is ${ticket.status.replace("_", " ")}`,
        body: ticket.subject,
        href: `/support?ticket=${encodeURIComponent(ticket.id)}`,
        createdAt: ticket.updatedAt,
        priority: "normal",
      });
    }
  }

  notifications.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return NextResponse.json({ notifications: notifications.slice(0, 30) }, { headers: { "Cache-Control": "no-store" } });
}
