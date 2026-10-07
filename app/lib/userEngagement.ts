import clientPromise from "@/app/lib/mongodb";

const DB_NAME = "mangosta";

export type EngagementEventType =
  | "page_view"
  | "product_view"
  | "search"
  | "wishlist_add"
  | "wishlist_remove"
  | "cart_add"
  | "cart_remove"
  | "checkout_start"
  | "checkout_complete"
  | "purchase"
  | "review_submit"
  | "notification_open"
  | "notification_click"
  | "support_open"
  | "coupon_apply"
  | "product_share";

export interface EngagementEvent {
  event: EngagementEventType;

  /**
   * Logged-in customer's id.
   * Undefined for anonymous visitors.
   */
  userId?: string;

  /**
   * Browser/session identifier.
   * This lets us understand anonymous journeys and sessions.
   */
  sessionId: string;

  /**
   * Product associated with the event, when applicable.
   */
  productId?: string;

  /**
   * Search query, when the event is a search.
   */
  searchQuery?: string;

  /**
   * Current page/path.
   */
  path?: string;

  /**
   * Additional non-sensitive event information.
   */
  metadata?: Record<string, unknown>;

  createdAt: Date;
}

export interface TrackEngagementEventInput {
  event: EngagementEventType;
  userId?: string;
  sessionId: string;
  productId?: string;
  searchQuery?: string;
  path?: string;
  metadata?: Record<string, unknown>;
}

function cleanString(value: unknown, maxLength = 500): string | undefined {
  if (typeof value !== "string") return undefined;

  const trimmed = value.trim();

  if (!trimmed) return undefined;

  return trimmed.slice(0, maxLength);
}

function cleanMetadata(
  metadata: Record<string, unknown> | undefined
): Record<string, unknown> | undefined {
  if (!metadata || typeof metadata !== "object") {
    return undefined;
  }

  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(metadata)) {
    if (!key.trim()) continue;

    if (
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
    ) {
      result[key.slice(0, 100)] =
        typeof value === "string"
          ? value.slice(0, 500)
          : value;
    }
  }

  return Object.keys(result).length > 0 ? result : undefined;
}

/**
 * Stores one customer/visitor engagement event.
 *
 * Server-only.
 */
export async function trackEngagementEvent(
  input: TrackEngagementEventInput
): Promise<void> {
  const sessionId = cleanString(input.sessionId, 200);

  if (!sessionId) {
    return;
  }

  const db = (await clientPromise).db(DB_NAME);

  const event: EngagementEvent = {
    event: input.event,
    sessionId,
    createdAt: new Date(),
  };

  const userId = cleanString(input.userId, 200);
  const productId = cleanString(input.productId, 200);
  const searchQuery = cleanString(input.searchQuery, 300);
  const path = cleanString(input.path, 500);
  const metadata = cleanMetadata(input.metadata);

  if (userId) {
    event.userId = userId;
  }

  if (productId) {
    event.productId = productId;
  }

  if (searchQuery) {
    event.searchQuery = searchQuery;
  }

  if (path) {
    event.path = path;
  }

  if (metadata) {
    event.metadata = metadata;
  }

  await db.collection<EngagementEvent>("userEvents").insertOne(event);
}

let indexesReady: Promise<void> | null = null;

/**
 * Creates the indexes used by the admin User analytics pages.
 * Runs once per server instance; a failure is logged and never breaks
 * analytics (queries still work, just without the index).
 */
export function ensureEngagementIndexes(): Promise<void> {
  if (!indexesReady) {
    indexesReady = (async () => {
      const db = (await clientPromise).db(DB_NAME);
      const events = db.collection<EngagementEvent>("userEvents");
      const orders = db.collection("orders");

      const results = await Promise.allSettled([
        events.createIndex({ createdAt: -1 }),
        events.createIndex({ userId: 1, createdAt: -1 }),
        events.createIndex({ sessionId: 1, createdAt: -1 }),
        events.createIndex({ event: 1, createdAt: -1 }),
        events.createIndex({ productId: 1, event: 1, createdAt: -1 }),
        events.createIndex({ "metadata.orderId": 1 }),
        orders.createIndex({ createdAt: -1 }),
        orders.createIndex({ "customer.email": 1 }),
        orders.createIndex({ userId: 1 }),
        db.collection("users").createIndex({ createdAt: -1 }),
      ]);

      for (const result of results) {
        if (result.status === "rejected") {
          console.warn("[ENGAGEMENT] Index not created:", result.reason);
        }
      }
    })().catch((error) => {
      console.warn("[ENGAGEMENT] Index setup skipped:", error);
    });
  }

  return indexesReady;
}
