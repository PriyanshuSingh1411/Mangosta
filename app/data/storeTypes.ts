// Types and pure helpers for the store features (size guide, delivery /
// pincode check, returns, reviews, email automations). No server imports,
// so these are safe to use from both client and server code.

import type { ProductCategory } from "./productTypes";

export const PRODUCT_CATEGORIES: ProductCategory[] = [
  "t-shirts",
  "hoodies",
  "pants",
  "jackets",
  "accessories",
];

export const CATEGORY_LABELS: Record<ProductCategory, string> = {
  "t-shirts": "T-Shirts",
  hoodies: "Hoodies",
  pants: "Pants",
  jackets: "Jackets",
  accessories: "Accessories",
};

// ============================================================
// SIZE GUIDE
// ============================================================

export type MeasureUnit = "cm" | "in";

export interface SizeChartRow {
  size: string;
  /** One value per column, as typed by the admin (numbers or ranges). */
  values: string[];
}

export interface SizeChart {
  columns: string[];
  rows: SizeChartRow[];
  note: string;
}

export interface SizeGuideConfig {
  /** Unit the admin typed the measurements in. */
  unit: MeasureUnit;
  howToMeasure: string;
  charts: Partial<Record<ProductCategory, SizeChart>>;
}

export const DEFAULT_SIZE_GUIDE: SizeGuideConfig = {
  unit: "cm",
  howToMeasure:
    "Chest: measure across the chest, 2 cm below the armholes, with the garment laid flat. Length: from the highest point of the shoulder to the hem.",
  charts: {},
};

export function chartHasRows(chart?: SizeChart | null): chart is SizeChart {
  return Boolean(
    chart &&
      chart.columns.length > 0 &&
      chart.rows.some((row) => row.size.trim())
  );
}

/**
 * Converts one typed measurement ("102", "76-80", "30.5") between cm and
 * inches. Anything that isn't a number (or number range) is returned as is.
 */
export function convertMeasurement(
  value: string,
  from: MeasureUnit,
  to: MeasureUnit
): string {
  if (from === to) return value;

  return value.replace(/\d+(?:\.\d+)?/g, (match) => {
    const number = Number(match);
    if (!Number.isFinite(number)) return match;

    const converted = from === "cm" ? number / 2.54 : number * 2.54;
    const rounded = Math.round(converted * 10) / 10;

    return Number.isInteger(rounded)
      ? String(rounded)
      : rounded.toFixed(1);
  });
}

// ============================================================
// DELIVERY / PINCODE
// ============================================================

export interface PincodeRule {
  id: string;
  /** 1–6 leading digits, e.g. "400" (Mumbai) or "110001". */
  prefix: string;
  label: string;
  minDays: number;
  maxDays: number;
  cod: boolean;
  serviceable: boolean;
}

export interface DeliveryConfig {
  /** Show the pincode check on product pages and enforce it at checkout. */
  enabled: boolean;
  /** Pincodes not matched by any rule can still be delivered to. */
  deliverEverywhere: boolean;
  defaultMinDays: number;
  defaultMaxDays: number;
  defaultCod: boolean;
  rules: PincodeRule[];
}

export const DEFAULT_DELIVERY: DeliveryConfig = {
  enabled: true,
  deliverEverywhere: true,
  defaultMinDays: 5,
  defaultMaxDays: 8,
  defaultCod: true,
  rules: [],
};

export interface PincodeCheckResult {
  valid: boolean;
  serviceable: boolean;
  cod: boolean;
  minDays: number;
  maxDays: number;
  /** Rule label (e.g. "Mumbai") when a rule matched. */
  area: string;
}

export function isValidPincode(pincode: string): boolean {
  return /^[1-9]\d{5}$/.test(String(pincode ?? "").trim());
}

/** Longest matching prefix wins; no match → the default settings. */
export function checkPincode(
  config: DeliveryConfig,
  pincode: string
): PincodeCheckResult {
  const code = String(pincode ?? "").trim();

  if (!isValidPincode(code)) {
    return {
      valid: false,
      serviceable: false,
      cod: false,
      minDays: 0,
      maxDays: 0,
      area: "",
    };
  }

  const rule = config.rules
    .filter(
      (candidate) =>
        candidate.prefix && code.startsWith(candidate.prefix)
    )
    .sort((a, b) => b.prefix.length - a.prefix.length)[0];

  if (rule) {
    return {
      valid: true,
      serviceable: rule.serviceable,
      cod: rule.serviceable && rule.cod,
      minDays: rule.minDays,
      maxDays: Math.max(rule.minDays, rule.maxDays),
      area: rule.label,
    };
  }

  return {
    valid: true,
    serviceable: config.deliverEverywhere,
    cod: config.deliverEverywhere && config.defaultCod,
    minDays: config.defaultMinDays,
    maxDays: Math.max(config.defaultMinDays, config.defaultMaxDays),
    area: "",
  };
}

/** "Mon, 12 Oct – Thu, 15 Oct" style range starting from `from`. */
export function formatDeliveryRange(
  minDays: number,
  maxDays: number,
  from: Date = new Date()
): string {
  const format = (days: number) => {
    const date = new Date(from.getTime() + days * 86_400_000);
    return new Intl.DateTimeFormat("en-IN", {
      weekday: "short",
      day: "numeric",
      month: "short",
    }).format(date);
  };

  return minDays === maxDays
    ? format(minDays)
    : `${format(minDays)} – ${format(maxDays)}`;
}

// ============================================================
// RETURNS & EXCHANGES
// ============================================================

export interface ReturnsPolicy {
  enabled: boolean;
  windowDays: number;
  allowReturns: boolean;
  allowExchanges: boolean;
  reasons: string[];
  policyText: string;
}

export const DEFAULT_RETURNS_POLICY: ReturnsPolicy = {
  enabled: true,
  windowDays: 7,
  allowReturns: true,
  allowExchanges: true,
  reasons: [
    "Size too small",
    "Size too large",
    "Different from the photos",
    "Damaged or defective",
    "Wrong item received",
    "Changed my mind",
  ],
  policyText:
    "Items must be unworn, unwashed and returned with their tags within the return window.",
};

export type ReturnRequestType = "return" | "exchange";

export type ReturnRequestStatus =
  | "requested"
  | "approved"
  | "rejected"
  | "received"
  | "completed";

export const RETURN_STATUS_LABELS: Record<ReturnRequestStatus, string> = {
  requested: "REQUESTED",
  approved: "APPROVED",
  rejected: "REJECTED",
  received: "RECEIVED",
  completed: "COMPLETED",
};

export interface ReturnRequestItem {
  lineId: string;
  productId: string;
  productName: string;
  color: string;
  size: string;
  quantity: number;
  image: string;
  /** Exchanges only: the size / colour the customer wants instead. */
  exchangeSize?: string;
  exchangeColor?: string;
}

export interface ReturnRequest {
  id: string;
  orderId: string;
  customerEmail: string;
  customerName: string;
  type: ReturnRequestType;
  items: ReturnRequestItem[];
  reason: string;
  note: string;
  status: ReturnRequestStatus;
  adminNote: string;
  /** Stock was added back when the items were received. */
  restocked: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Days left to request a return (null = window closed / not delivered). */
export function returnDaysLeft(
  order: { status: string; deliveredAt?: string; createdAt: string },
  policy: ReturnsPolicy,
  now: Date = new Date()
): number | null {
  if (!policy.enabled || order.status !== "delivered") return null;

  // Orders delivered before delivery dates were recorded use the order date.
  const start = new Date(order.deliveredAt || order.createdAt).getTime();
  if (!Number.isFinite(start)) return null;

  const end = start + policy.windowDays * 86_400_000;
  const left = Math.ceil((end - now.getTime()) / 86_400_000);

  return left > 0 ? left : null;
}

// ============================================================
// REVIEWS
// ============================================================

export interface Review {
  id: string;
  productId: string;
  userId: string;
  /** "Ravi P." — first name + last initial. */
  authorName: string;
  rating: number;
  title: string;
  body: string;
  photos: string[];
  color: string;
  size: string;
  verified: boolean;
  status: "published" | "hidden";
  createdAt: string;
  /** Number of signed-in customers who found it helpful. */
  helpful?: number;
  /** Short public answer from Mangosta (written in Admin → Reviews). */
  reply?: { text: string; at: string };
}

/** A review as the shop shows it (no user id; flags for the viewer). */
export type PublicReview = Omit<Review, "userId"> & {
  /** Written by the signed-in viewer. */
  mine: boolean;
  /** The signed-in viewer marked it helpful. */
  voted: boolean;
};

export type ReviewSort = "newest" | "helpful" | "highest" | "lowest" | "photos";

export const REVIEW_SORTS: { value: ReviewSort; label: string }[] = [
  { value: "newest", label: "Newest" },
  { value: "helpful", label: "Most helpful" },
  { value: "highest", label: "Highest rating" },
  { value: "lowest", label: "Lowest rating" },
  { value: "photos", label: "With photos" },
];

/** Sorts (and for "photos", filters) reviews for display. */
export function sortReviews<T extends Pick<Review, "createdAt" | "rating" | "photos" | "helpful">>(
  reviews: T[],
  sort: ReviewSort
): T[] {
  const newest = (a: T, b: T) => b.createdAt.localeCompare(a.createdAt);
  const list = sort === "photos" ? reviews.filter((review) => review.photos.length > 0) : [...reviews];

  switch (sort) {
    case "helpful":
      return list.sort((a, b) => (b.helpful ?? 0) - (a.helpful ?? 0) || newest(a, b));
    case "highest":
      return list.sort((a, b) => b.rating - a.rating || newest(a, b));
    case "lowest":
      return list.sort((a, b) => a.rating - b.rating || newest(a, b));
    default:
      return list.sort(newest);
  }
}

export interface ReviewSummary {
  average: number;
  count: number;
  /** Index 0 = 1 star … index 4 = 5 stars. */
  distribution: [number, number, number, number, number];
}

export const EMPTY_REVIEW_SUMMARY: ReviewSummary = {
  average: 0,
  count: 0,
  distribution: [0, 0, 0, 0, 0],
};

export function summarizeReviews(
  reviews: Pick<Review, "rating">[]
): ReviewSummary {
  const distribution: ReviewSummary["distribution"] = [0, 0, 0, 0, 0];
  let total = 0;

  for (const review of reviews) {
    const rating = Math.min(5, Math.max(1, Math.round(review.rating)));
    distribution[rating - 1] += 1;
    total += rating;
  }

  const count = reviews.length;

  return {
    average: count ? Math.round((total / count) * 10) / 10 : 0,
    count,
    distribution,
  };
}

// ============================================================
// EMAIL AUTOMATIONS
// ============================================================

export interface EmailAutomationConfig {
  abandonedBagEnabled: boolean;
  /** Minimum hours a bag must sit untouched before the reminder. */
  abandonedBagDelayHours: number;
  abandonedBagSubject: string;
  abandonedBagHeading: string;
  abandonedBagBody: string;
  abandonedBagButtonText: string;
  backInStockEnabled: boolean;
  backInStockSubject: string;
}

export const DEFAULT_EMAIL_AUTOMATION: EmailAutomationConfig = {
  abandonedBagEnabled: true,
  abandonedBagDelayHours: 24,
  abandonedBagSubject: "You left something in your bag",
  abandonedBagHeading: "STILL THINKING IT OVER?",
  abandonedBagBody:
    "Your MANGOSTA bag is waiting for you. Sizes sell out fast, so pick up where you left off before they're gone.",
  abandonedBagButtonText: "RETURN TO MY BAG",
  backInStockEnabled: true,
  backInStockSubject: "It's back: {product}",
};

// ============================================================
// CUSTOMER SUPPORT
// ============================================================

/** WhatsApp number for "Need help with this order?" (country code + number, digits only). */
export const SUPPORT_WHATSAPP_NUMBER = "919665082640";
export const SUPPORT_WHATSAPP_DISPLAY = "+91 9665082640";

/** wa.me link that opens WhatsApp with the order number already typed. */
export function whatsappOrderLink(orderId: string): string {
  return `https://wa.me/${SUPPORT_WHATSAPP_NUMBER}?text=${encodeURIComponent(
    `Hi Mangosta, I need help with my order ${orderId}.`
  )}`;
}

// ============================================================
// ORDER CANCELLATION
// ============================================================

export const CANCEL_REASONS = [
  "Ordered by mistake",
  "Want a different size or colour",
  "Found a better price elsewhere",
  "Delivery date is too late",
  "Other",
];
