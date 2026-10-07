import { NextResponse } from "next/server";
import { getCurrentUser } from "@/app/lib/auth/session";
import { getOrders } from "@/app/lib/dataStore";
import { getReviewedProductIds } from "@/app/lib/reviews";
import { getWishlistItems } from "@/app/lib/wishlist";
import { getCustomerTickets } from "@/app/lib/support";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  const email = user.email.trim().toLowerCase();
  const orders = (await getOrders()).filter((order) => order.customer.email.trim().toLowerCase() === email);
  const [wishlist, reviews, tickets] = await Promise.all([getWishlistItems(user.id), getReviewedProductIds(user.id), getCustomerTickets(user.id)]);
  return NextResponse.json({ user, stats: { orders: orders.length, wishlist: wishlist.length, reviews: reviews.length, openTickets: tickets.filter((ticket) => ticket.status !== "resolved").length }, recentOrders: orders.slice(0, 3) });
}
