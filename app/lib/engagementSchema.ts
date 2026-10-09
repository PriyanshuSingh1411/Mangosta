import "server-only";
import type { EngagementEventType } from "@/app/lib/userEngagement";

// What the browser may send for each analytics event (POST /api/engagement).
// Anything not listed here is dropped, every value is type- and
// length-checked, so a script can't stuff events with extra data or fake
// fields. Wishlist, review and purchase events are recorded by the server
// itself and never accepted from the browser.

type FieldType = "string" | "number" | "boolean";

interface EventSchema {
  /** The event is about one product (productId required and must exist). */
  product?: boolean;
  /** The event carries a search query. */
  searchQuery?: boolean;
  metadata: Record<string, FieldType>;
}

const CART_FIELDS: Record<string, FieldType> = {
  productName: "string",
  category: "string",
  size: "string",
  color: "string",
  quantity: "number",
  price: "number",
  previousQuantity: "number",
  newQuantity: "number",
  reason: "string",
};

export const BROWSER_EVENTS: Record<string, EventSchema> = {
  page_view: { metadata: { itemCount: "number" } },
  product_view: { product: true, metadata: { productName: "string", category: "string" } },
  search: { searchQuery: true, metadata: { query: "string", resultCount: "number", source: "string" } },
  cart_add: { product: true, metadata: CART_FIELDS },
  cart_remove: { product: true, metadata: CART_FIELDS },
  checkout_start: {
    metadata: {
      itemCount: "number",
      uniqueProducts: "number",
      subtotal: "number",
      discount: "number",
      shipping: "number",
      total: "number",
      couponCode: "string",
      couponType: "string",
    },
  },
  notification_open: { metadata: { notificationCount: "number", unreadCount: "number" } },
  notification_click: {
    metadata: { notificationId: "string", notificationType: "string", href: "string", priority: "string" },
  },
  support_open: { metadata: { source: "string", orderId: "string" } },
  coupon_apply: {
    metadata: {
      couponCode: "string",
      discount: "number",
      discountType: "string",
      subtotal: "number",
      isProgressReward: "boolean",
    },
  },
  product_share: { product: true, metadata: { method: "string", productName: "string", category: "string" } },
};

const MAX_TEXT = 120;
const MAX_NUMBER = 1_000_000_000;

export interface CleanBrowserEvent {
  event: EngagementEventType;
  productId?: string;
  searchQuery?: string;
  path?: string;
  metadata?: Record<string, string | number | boolean>;
}

function cleanText(value: unknown, max = MAX_TEXT): string | undefined {
  if (typeof value !== "string") return undefined;
  const text = value.trim().slice(0, max);
  return text || undefined;
}

/**
 * Validates a browser event against its schema. Returns null when the
 * event isn't allowed or misses a required field.
 */
export function cleanBrowserEvent(body: unknown): CleanBrowserEvent | null {
  if (!body || typeof body !== "object") return null;
  const input = body as Record<string, unknown>;
  const event = String(input.event ?? "");
  const schema = Object.prototype.hasOwnProperty.call(BROWSER_EVENTS, event)
    ? BROWSER_EVENTS[event]
    : null;
  if (!schema) return null;

  const clean: CleanBrowserEvent = { event: event as EngagementEventType };

  if (schema.product) {
    const productId = cleanText(input.productId, 60);
    if (!productId) return null;
    clean.productId = productId;
  }

  if (schema.searchQuery) {
    const searchQuery = cleanText(input.searchQuery, 120);
    if (searchQuery) clean.searchQuery = searchQuery;
  }

  // Site paths only, e.g. "/product/mangosta-core-tee".
  const path = cleanText(input.path, 200);
  if (path && /^\/[\w\-./%~]*$/.test(path)) clean.path = path;

  const raw = input.metadata;
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const metadata: Record<string, string | number | boolean> = {};
    for (const [key, type] of Object.entries(schema.metadata)) {
      const value = (raw as Record<string, unknown>)[key];
      if (type === "string") {
        const text = cleanText(value);
        if (text !== undefined) metadata[key] = text;
      } else if (type === "number") {
        if (typeof value === "number" && Number.isFinite(value) && Math.abs(value) <= MAX_NUMBER) {
          metadata[key] = value;
        }
      } else if (typeof value === "boolean") {
        metadata[key] = value;
      }
    }
    if (Object.keys(metadata).length > 0) clean.metadata = metadata;
  }

  return clean;
}
