import "server-only";

import { cookies } from "next/headers";

import {
  trackEngagementEvent,
  type EngagementEventType,
} from "@/app/lib/userEngagement";

export type { EngagementEventType };

/** Same cookie the browser tracker (/api/engagement) uses. */
export const ENGAGEMENT_SESSION_COOKIE = "mangosta_engagement_session";

const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

/**
 * The visitor's engagement session id. When the visitor has no session
 * cookie yet, one is created so server-side events are always tied to a
 * session (Feature Usage sessions, search → purchase attribution).
 *
 * Await it inside a Route Handler before the response is returned — cookies
 * can only be set there.
 */
export async function getEngagementSessionId(): Promise<string> {
  const store = await cookies();
  const existing = store.get(ENGAGEMENT_SESSION_COOKIE)?.value?.trim();

  if (existing) return existing.slice(0, 200);

  const sessionId = crypto.randomUUID();

  try {
    store.set(ENGAGEMENT_SESSION_COOKIE, sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_MAX_AGE_SECONDS,
    });
  } catch {
    // Read-only context (e.g. a Server Component): the id is still used
    // for this event.
  }

  return sessionId;
}

interface TrackServerEngagementInput {
  event: EngagementEventType;
  /** Signed-in customer, when there is one. */
  userId?: string;
  productId?: string;
  path?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Records an engagement event from server code (wishlist, reviews, orders).
 * Always awaited by callers so the session cookie can be read / set; never
 * throws — analytics must not break the customer action.
 */
export async function trackServerEngagement({
  event,
  userId,
  productId,
  path,
  metadata,
}: TrackServerEngagementInput): Promise<void> {
  try {
    const sessionId = await getEngagementSessionId();

    await trackEngagementEvent({
      event,
      userId,
      sessionId,
      productId,
      path,
      metadata,
    });
  } catch (error) {
    console.error("[ENGAGEMENT] Failed to record event:", error);
  }
}
