import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/app/lib/auth/session";
import { trackEngagementEvent } from "@/app/lib/userEngagement";
import { cleanBrowserEvent } from "@/app/lib/engagementSchema";
import { consumeRateLimits, getClientIp } from "@/app/lib/rateLimit";
import { getProducts } from "@/app/lib/dataStore";

/**
 * POST /api/engagement — analytics events from the browser.
 *
 * Only the events and fields listed in app/lib/engagementSchema.ts are
 * accepted (everything else is dropped), product events must name a real
 * product, and each browser session / network is rate-limited, so the
 * Admin → User analytics can't be flooded or skewed by a script.
 */

const SESSION_COOKIE = "mangosta_engagement_session";
const TEN_MINUTES = 10 * 60 * 1000;
const SESSION_LIMIT = 120; // events per browser session per 10 minutes
const NETWORK_LIMIT = 600; // events per network per 10 minutes

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The browser's session id (a UUID this site issued), or null. */
function sessionIdFromCookie(request: NextRequest): string | null {
  const value = request.cookies.get(SESSION_COOKIE)?.value ?? "";
  return UUID.test(value) ? value.toLowerCase() : null;
}

// Product ids, refreshed at most once a minute (product events must name
// a real product).
let productIds: { at: number; ids: Set<string> } | null = null;

async function isKnownProduct(id: string): Promise<boolean> {
  if (!productIds || Date.now() - productIds.at > 60_000) {
    const products = await getProducts();
    productIds = { at: Date.now(), ids: new Set(products.map((product) => product.id)) };
  }
  return productIds.ids.has(id);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);
    const clean = cleanBrowserEvent(body);

    if (!clean) {
      return NextResponse.json(
        { error: "Invalid engagement event." },
        { status: 400 }
      );
    }

    const existingSession = sessionIdFromCookie(request);
    const sessionId = existingSession ?? crypto.randomUUID();

    // The network limit is the hard cap (a script can always start new
    // sessions); the session limit stops one browser from flooding.
    const rate = await consumeRateLimits([
      { key: `engagement:ip:${getClientIp(request)}`, limit: NETWORK_LIMIT, windowMs: TEN_MINUTES },
      ...(existingSession
        ? [{ key: `engagement:session:${existingSession}`, limit: SESSION_LIMIT, windowMs: TEN_MINUTES }]
        : []),
    ]);

    if (!rate.allowed) {
      return NextResponse.json(
        { error: "Too many events." },
        { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } }
      );
    }

    if (clean.productId && !(await isKnownProduct(clean.productId))) {
      return NextResponse.json(
        { error: "Unknown product." },
        { status: 400 }
      );
    }

    const user = await getCurrentUser();

    await trackEngagementEvent({
      ...clean,
      userId: user?.id,
      sessionId,
    });

    const response = NextResponse.json({ ok: true, sessionId });

    if (!existingSession) {
      response.cookies.set(SESSION_COOKIE, sessionId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 30 * 24 * 60 * 60,
      });
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
