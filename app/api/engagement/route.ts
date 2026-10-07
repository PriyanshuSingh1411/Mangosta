import { NextResponse } from "next/server";
import { getCurrentUser } from "@/app/lib/auth/session";
import {
  trackEngagementEvent,
  type EngagementEventType,
} from "@/app/lib/userEngagement";

/**
 * Events the browser may send. Wishlist, review and purchase events are
 * recorded by the server itself (wishlist API, reviews API, checkout API),
 * so the browser can't add duplicates or fake purchases.
 */
const ALLOWED_EVENTS: EngagementEventType[] = [
  "page_view",
  "product_view",
  "search",
  "cart_add",
  "cart_remove",
  "checkout_start",
  "notification_open",
  "notification_click",
  "support_open",
  "coupon_apply",
  "product_share",
];

function getOrCreateSessionId(request: Request): string {
  const cookieHeader = request.headers.get("cookie") || "";

  const match = cookieHeader.match(
    /(?:^|;\s*)mangosta_engagement_session=([^;]+)/
  );

  if (match?.[1]) {
    return decodeURIComponent(match[1]);
  }

  return crypto.randomUUID();
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const event = String(body?.event || "") as EngagementEventType;

    if (!ALLOWED_EVENTS.includes(event)) {
      return NextResponse.json(
        { error: "Invalid engagement event." },
        { status: 400 }
      );
    }

    const sessionId = getOrCreateSessionId(request);
    const user = await getCurrentUser();

    await trackEngagementEvent({
      event,
      userId: user?.id,
      sessionId,
      productId:
        typeof body?.productId === "string"
          ? body.productId
          : undefined,
      searchQuery:
        typeof body?.searchQuery === "string"
          ? body.searchQuery
          : undefined,
      path:
        typeof body?.path === "string"
          ? body.path
          : undefined,
      metadata:
        body?.metadata &&
        typeof body.metadata === "object"
          ? body.metadata
          : undefined,
    });

    const response = NextResponse.json({
      ok: true,
      sessionId,
    });

    if (!cookieHeaderHasSession(request)) {
      response.cookies.set(
        "mangosta_engagement_session",
        sessionId,
        {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          path: "/",
          maxAge: 30 * 24 * 60 * 60,
        }
      );
    }

    return response;
  } catch (error) {
    console.error("[ENGAGEMENT] Failed to track event:", error);

    return NextResponse.json(
      { error: "Unable to record engagement event." },
      { status: 500 }
    );
  }
}

function cookieHeaderHasSession(request: Request): boolean {
  const cookieHeader = request.headers.get("cookie") || "";

  return /(?:^|;\s*)mangosta_engagement_session=/.test(
    cookieHeader
  );
}