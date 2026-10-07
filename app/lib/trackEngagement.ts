"use client";

/**
 * Events the browser sends. Wishlist, review and purchase events are
 * recorded by the server (see app/lib/userEngagementServer.ts).
 */
export type EngagementEvent =
  | "page_view"
  | "product_view"
  | "search"
  | "cart_add"
  | "cart_remove"
  | "checkout_start"
  | "notification_open"
  | "notification_click"
  | "support_open"
  | "coupon_apply"
  | "product_share";

interface TrackEngagementInput {
  event: EngagementEvent;
  productId?: string;
  searchQuery?: string;
  path?: string;
  metadata?: Record<string, unknown>;
}

export async function trackEngagement({
  event,
  productId,
  searchQuery,
  path,
  metadata,
}: TrackEngagementInput): Promise<void> {
  try {
    await fetch("/api/engagement", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
      keepalive: true,
      body: JSON.stringify({
        event,
        productId,
        searchQuery,
        path: path || window.location.pathname,
        metadata,
      }),
    });
  } catch {
    // Analytics must never interrupt the shopping experience.
  }
}