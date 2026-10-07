import "server-only";

import type { Db, Document } from "mongodb";

import clientPromise from "@/app/lib/mongodb";
import { ensureEngagementIndexes } from "@/app/lib/userEngagement";

/* ==========================================================================
 * Mangosta — shared User analytics core
 *
 * Every admin "User" page (Overview, Feature Usage, Customer Profiles,
 * Segments, Retention, LTV, Search, Product Discovery) uses this file, so the
 * same customer, order, date range and score produce the same numbers on
 * every page.
 *
 * Sources of truth
 *   Money (revenue, orders, LTV, AOV) ...... `orders` collection
 *   Behaviour (views, wishlist, cart, ...) .. `userEvents` collection
 *   Customer accounts ....................... `users` collection
 * ========================================================================== */

export const ANALYTICS_DB_NAME = "mangosta";

export async function getAnalyticsDb(): Promise<Db> {
  const db = (await clientPromise).db(ANALYTICS_DB_NAME);
  await ensureEngagementIndexes();
  return db;
}

/* --------------------------------------------------------------------------
 * Small value helpers
 * ------------------------------------------------------------------------ */

export function toAmount(value: unknown): number {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

/** Rounds money to paise so sums never show floating-point noise. */
export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/** part / whole as a percentage (one decimal). 0 when whole is 0. */
export function percent(part: number, whole: number): number {
  if (!(whole > 0)) return 0;
  return Number(((part / whole) * 100).toFixed(1));
}

export function cleanText(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return "";
}

export function normalizeEmail(value: unknown): string {
  return cleanText(value).toLowerCase();
}

export function toValidDate(value: unknown): Date | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === "string" || typeof value === "number") {
    if (value === "") return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  return null;
}

export function toIso(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}

function earliest(...values: (Date | null | undefined)[]): Date | null {
  let result: Date | null = null;
  for (const value of values) {
    if (value && (!result || value.getTime() < result.getTime())) {
      result = value;
    }
  }
  return result;
}

function latest(...values: (Date | null | undefined)[]): Date | null {
  let result: Date | null = null;
  for (const value of values) {
    if (value && (!result || value.getTime() > result.getTime())) {
      result = value;
    }
  }
  return result;
}

export function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/* --------------------------------------------------------------------------
 * Dates — every User page uses India time (Asia/Kolkata)
 * ------------------------------------------------------------------------ */

export const INDIA_TIME_ZONE = "Asia/Kolkata";

/** India Standard Time is UTC+05:30 all year (no daylight saving). */
const IST_OFFSET_MS = 330 * 60 * 1000;

export const DAY_MS = 24 * 60 * 60 * 1000;

export type AnalyticsRange = "today" | "yesterday" | "7d" | "30d" | "month";

export const ANALYTICS_RANGES: readonly AnalyticsRange[] = [
  "today",
  "yesterday",
  "7d",
  "30d",
  "month",
];

const RANGE_LABELS: Record<AnalyticsRange, string> = {
  today: "Today",
  yesterday: "Yesterday",
  "7d": "Last 7 days",
  "30d": "Last 30 days",
  month: "This month",
};

export function normalizeRange(value: unknown): AnalyticsRange {
  return ANALYTICS_RANGES.includes(value as AnalyticsRange)
    ? (value as AnalyticsRange)
    : "30d";
}

/** "YYYY-MM-DD" of the India calendar day containing this instant. */
export function indiaDateKey(value: Date): string {
  return new Date(value.getTime() + IST_OFFSET_MS)
    .toISOString()
    .slice(0, 10);
}

function keyToUtcMidnight(key: string): number {
  const [year, month, day] = key.split("-").map(Number);
  return Date.UTC(year, month - 1, day);
}

export function addDaysToKey(key: string, days: number): string {
  return new Date(keyToUtcMidnight(key) + days * DAY_MS)
    .toISOString()
    .slice(0, 10);
}

export function daysBetweenKeys(fromKey: string, toKey: string): number {
  return Math.round(
    (keyToUtcMidnight(toKey) - keyToUtcMidnight(fromKey)) / DAY_MS
  );
}

/** 00:00 India time at the start of an India calendar day. */
export function indiaDayStart(key: string): Date {
  return new Date(keyToUtcMidnight(key) - IST_OFFSET_MS);
}

export interface AnalyticsPeriod {
  range: AnalyticsRange;
  label: string;
  /** First and last India calendar day of the period (inclusive). */
  startKey: string;
  endKey: string;
  /** 00:00 IST on startKey. */
  start: Date;
  /** 00:00 IST on the day after endKey. */
  endExclusive: Date;
  /** Every India calendar day in the period, oldest first. */
  dateKeys: string[];
  todayKey: string;
}

/**
 * The one date-range definition used by every User analytics page.
 *
 *   today      today (India time)
 *   yesterday  yesterday
 *   7d         the last 7 days including today
 *   30d        the last 30 days including today
 *   month      the 1st of this month up to today
 */
export function getAnalyticsPeriod(
  rangeInput: unknown,
  now: Date = new Date()
): AnalyticsPeriod {
  const range = normalizeRange(rangeInput);
  const todayKey = indiaDateKey(now);

  let startKey = todayKey;
  let endKey = todayKey;

  switch (range) {
    case "yesterday":
      startKey = addDaysToKey(todayKey, -1);
      endKey = startKey;
      break;
    case "7d":
      startKey = addDaysToKey(todayKey, -6);
      break;
    case "30d":
      startKey = addDaysToKey(todayKey, -29);
      break;
    case "month":
      startKey = `${todayKey.slice(0, 7)}-01`;
      break;
    case "today":
    default:
      break;
  }

  const dateKeys: string[] = [];
  for (let key = startKey; key <= endKey; key = addDaysToKey(key, 1)) {
    dateKeys.push(key);
  }

  return {
    range,
    label: RANGE_LABELS[range],
    startKey,
    endKey,
    start: indiaDayStart(startKey),
    endExclusive: indiaDayStart(addDaysToKey(endKey, 1)),
    dateKeys,
    todayKey,
  };
}

export function isInPeriod(
  date: Date | null | undefined,
  period: AnalyticsPeriod
): boolean {
  if (!date) return false;
  const time = date.getTime();
  return time >= period.start.getTime() && time < period.endExclusive.getTime();
}

/** Mongo filter for userEvents created inside the period. */
export function periodCreatedAtFilter(period: AnalyticsPeriod): Document {
  return {
    createdAt: { $gte: period.start, $lt: period.endExclusive },
  };
}

export function publicPeriod(period: AnalyticsPeriod) {
  return {
    range: period.range,
    label: period.label,
    start: period.startKey,
    end: period.endKey,
    timeZone: INDIA_TIME_ZONE,
  };
}

/* --------------------------------------------------------------------------
 * Orders — the source of truth for money
 * ------------------------------------------------------------------------ */

export const VALID_ORDER_RULE =
  "All orders except cancelled orders and orders whose payment failed (same rule as the admin Dashboard).";

export function isValidOrder(status: unknown, paymentStatus: unknown): boolean {
  return (
    cleanText(status) !== "cancelled" && cleanText(paymentStatus) !== "failed"
  );
}

export interface AnalyticsOrderLine {
  productId: string;
  productName: string;
  quantity: number;
  /** Unit price paid (after product discount, before the order coupon). */
  price: number;
}

export interface AnalyticsOrder {
  id: string;
  createdAt: Date;
  email: string;
  firstName: string;
  lastName: string;
  mobile: string;
  /** Account that placed the order ("" when unknown). */
  userId: string;
  /** Browser engagement session that placed the order ("" when unknown). */
  sessionId: string;
  status: string;
  paymentStatus: string;
  subtotal: number;
  discount: number;
  shipping: number;
  total: number;
  itemCount: number;
  lines: AnalyticsOrderLine[];
  isValid: boolean;
}

const ORDER_PROJECTION = {
  _id: 1,
  id: 1,
  createdAt: 1,
  status: 1,
  paymentStatus: 1,
  customer: 1,
  userId: 1,
  engagementSessionId: 1,
  lines: 1,
  subtotal: 1,
  discount: 1,
  shipping: 1,
  total: 1,
};

function normalizeOrderDocument(document: Document): AnalyticsOrder | null {
  const createdAt = toValidDate(document.createdAt);
  if (!createdAt) return null;

  const id =
    cleanText(document.id) ||
    (document._id !== undefined && document._id !== null ? String(document._id) : "");
  if (!id) return null;

  const customer: Document =
    document.customer && typeof document.customer === "object"
      ? document.customer
      : {};

  const rawStatus = cleanText(document.status) || "pending";
  const status = rawStatus === "fulfilled" ? "delivered" : rawStatus;
  const paymentStatus = cleanText(document.paymentStatus) || "pending";

  const lines: AnalyticsOrderLine[] = Array.isArray(document.lines)
    ? document.lines
        .filter((line: unknown) => line && typeof line === "object")
        .map((line: Document) => ({
          productId: cleanText(line.productId),
          productName: cleanText(line.productName) || "Product",
          quantity: Math.max(0, Math.floor(toAmount(line.quantity))),
          price: Math.max(0, toAmount(line.price)),
        }))
    : [];

  return {
    id,
    createdAt,
    email: normalizeEmail(customer.email),
    firstName: cleanText(customer.firstName),
    lastName: cleanText(customer.lastName),
    mobile: cleanText(customer.mobile),
    userId: cleanText(document.userId),
    sessionId: cleanText(document.engagementSessionId),
    status,
    paymentStatus,
    subtotal: toAmount(document.subtotal),
    discount: Math.max(0, toAmount(document.discount)),
    shipping: Math.max(0, toAmount(document.shipping)),
    total: Math.max(0, toAmount(document.total)),
    itemCount: lines.reduce((sum, line) => sum + line.quantity, 0),
    lines,
    isValid: isValidOrder(status, paymentStatus),
  };
}

/**
 * Orders placed before orders stored the account/session use the purchase
 * tracking event (which carries the order id) to recover who placed them.
 */
async function loadPurchaseHints(
  db: Db,
  orderIds: string[]
): Promise<Map<string, { userId: string; sessionId: string }>> {
  const hints = new Map<string, { userId: string; sessionId: string }>();
  if (orderIds.length === 0) return hints;

  const CHUNK = 5000;

  for (let index = 0; index < orderIds.length; index += CHUNK) {
    const chunk = orderIds.slice(index, index + CHUNK);
    const rows = await db
      .collection("userEvents")
      .find(
        { event: "purchase", "metadata.orderId": { $in: chunk } },
        {
          projection: {
            userId: 1,
            sessionId: 1,
            createdAt: 1,
            "metadata.orderId": 1,
          },
        }
      )
      .sort({ createdAt: 1 })
      .toArray();

    for (const row of rows) {
      const orderId = cleanText(row.metadata?.orderId);
      if (!orderId) continue;

      const hint = hints.get(orderId) || { userId: "", sessionId: "" };
      if (!hint.userId) hint.userId = cleanText(row.userId);
      if (!hint.sessionId) hint.sessionId = cleanText(row.sessionId);
      hints.set(orderId, hint);
    }
  }

  return hints;
}

export interface LoadOrdersOptions {
  from?: Date;
  toExclusive?: Date;
  validOnly?: boolean;
  /** Extra Mongo filter (e.g. one customer's orders). */
  match?: Document;
}

/** Loads orders (oldest first), normalised, with account/session filled in. */
export async function loadOrders(
  db: Db,
  options: LoadOrdersOptions = {}
): Promise<AnalyticsOrder[]> {
  const conditions: Document[] = [];

  if (options.match) conditions.push(options.match);

  if (options.from || options.toExclusive) {
    // Orders store createdAt as an ISO string. A one-day margin keeps any
    // differently formatted legacy value in the database pre-filter; the
    // exact boundary is applied below on the parsed date.
    const isoRange: Document = {};
    const dateRange: Document = {};

    if (options.from) {
      isoRange.$gte = new Date(options.from.getTime() - DAY_MS).toISOString();
      dateRange.$gte = options.from;
    }

    if (options.toExclusive) {
      isoRange.$lt = new Date(
        options.toExclusive.getTime() + DAY_MS
      ).toISOString();
      dateRange.$lt = options.toExclusive;
    }

    conditions.push({
      $or: [{ createdAt: isoRange }, { createdAt: dateRange }],
    });
  }

  if (options.validOnly) {
    conditions.push({
      status: { $ne: "cancelled" },
      paymentStatus: { $ne: "failed" },
    });
  }

  const filter: Document =
    conditions.length === 0
      ? {}
      : conditions.length === 1
        ? conditions[0]
        : { $and: conditions };

  const documents = await db
    .collection("orders")
    .find(filter, { projection: ORDER_PROJECTION })
    .toArray();

  const orders = documents
    .map((document) => normalizeOrderDocument(document))
    .filter((order): order is AnalyticsOrder => {
      if (!order) return false;
      if (options.validOnly && !order.isValid) return false;
      const time = order.createdAt.getTime();
      if (options.from && time < options.from.getTime()) return false;
      if (options.toExclusive && time >= options.toExclusive.getTime()) {
        return false;
      }
      return true;
    });

  const needHints = orders
    .filter((order) => !order.userId || !order.sessionId)
    .map((order) => order.id);

  const hints = await loadPurchaseHints(db, needHints);

  for (const order of orders) {
    const hint = hints.get(order.id);
    if (!hint) continue;
    if (!order.userId) order.userId = hint.userId;
    if (!order.sessionId) order.sessionId = hint.sessionId;
  }

  return orders.sort(
    (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
  );
}

/**
 * Net value of each order line: the line total minus its share of the
 * order's coupon / reward discount (shipping excluded). Summing every line of
 * an order gives exactly order.total − order.shipping.
 */
export function netLineRevenue(order: AnalyticsOrder): number[] {
  const gross = order.lines.map((line) => line.quantity * line.price);
  const grossTotal = gross.reduce((sum, value) => sum + value, 0);

  if (grossTotal <= 0) return gross.map(() => 0);

  const net = Math.max(0, order.total - order.shipping);
  return gross.map((value) => (value / grossTotal) * net);
}

/* --------------------------------------------------------------------------
 * Customers — accounts, guests, and who owns each order
 * ------------------------------------------------------------------------ */

export interface UserLite {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  mobile: string;
  createdAt: Date | null;
  lastLoginAt: Date | null;
  emailVerified: boolean;
}

const USER_PROJECTION = {
  _id: 0,
  id: 1,
  email: 1,
  firstName: 1,
  lastName: 1,
  mobile: 1,
  createdAt: 1,
  lastLoginAt: 1,
  emailVerified: 1,
};

function normalizeUser(document: Document): UserLite | null {
  const id = cleanText(document.id);
  if (!id) return null;

  return {
    id,
    email: normalizeEmail(document.email),
    firstName: cleanText(document.firstName),
    lastName: cleanText(document.lastName),
    mobile: cleanText(document.mobile),
    createdAt: toValidDate(document.createdAt),
    lastLoginAt: toValidDate(document.lastLoginAt),
    emailVerified: Boolean(document.emailVerified),
  };
}

export async function loadUsers(
  db: Db,
  filter: Document = {}
): Promise<UserLite[]> {
  const documents = await db
    .collection("users")
    .find(filter, { projection: USER_PROJECTION })
    .toArray();

  return documents
    .map((document) => normalizeUser(document))
    .filter((user): user is UserLite => Boolean(user));
}

export interface CustomerIdentity {
  /** "user:<id>" for accounts, "guest:<email>" for guest checkouts. */
  key: string;
  userId: string | null;
  email: string;
  isGuest: boolean;
}

export function userKey(userId: string): string {
  return `user:${userId}`;
}

export function guestKey(email: string): string {
  return `guest:${email}`;
}

export class CustomerDirectory {
  readonly byId = new Map<string, UserLite>();
  readonly byEmail = new Map<string, UserLite>();

  constructor(users: UserLite[] = []) {
    this.add(users);
  }

  add(users: UserLite[]) {
    for (const user of users) {
      this.byId.set(user.id, user);
      if (user.email && !this.byEmail.has(user.email)) {
        this.byEmail.set(user.email, user);
      }
    }
  }

  userIdentity(user: UserLite): CustomerIdentity {
    return {
      key: userKey(user.id),
      userId: user.id,
      email: user.email,
      isGuest: false,
    };
  }

  /**
   * Who an order belongs to:
   *   1. the account saved on the order (or its purchase event)
   *   2. otherwise the account whose email matches the order email
   *   3. otherwise a guest customer identified by the order email
   */
  ownerOf(order: AnalyticsOrder): CustomerIdentity {
    const byId = order.userId ? this.byId.get(order.userId) : undefined;
    if (byId) return this.userIdentity(byId);

    const byEmail = order.email ? this.byEmail.get(order.email) : undefined;
    if (byEmail) return this.userIdentity(byEmail);

    const email = order.email || `order-${order.id}`;
    return { key: guestKey(email), userId: null, email: order.email, isGuest: true };
  }
}

/** Directory containing every account any of these orders could belong to. */
export async function loadDirectoryForOrders(
  db: Db,
  orders: AnalyticsOrder[],
  knownUsers: UserLite[] = []
): Promise<CustomerDirectory> {
  const directory = new CustomerDirectory(knownUsers);

  const ids = [
    ...new Set(
      orders
        .map((order) => order.userId)
        .filter((id) => id && !directory.byId.has(id))
    ),
  ];
  const emails = [
    ...new Set(
      orders
        .map((order) => order.email)
        .filter((email) => email && !directory.byEmail.has(email))
    ),
  ];

  if (ids.length || emails.length) {
    const or: Document[] = [];
    if (ids.length) or.push({ id: { $in: ids } });
    if (emails.length) or.push({ email: { $in: emails } });
    directory.add(await loadUsers(db, { $or: or }));
  }

  return directory;
}

export interface CustomerOrderSummary {
  identity: CustomerIdentity;
  /** Name / mobile from the customer's latest order (used for guests). */
  orderName: string;
  orderMobile: string;
  /** Valid orders (lifetime). */
  orders: number;
  revenue: number;
  firstOrderAt: Date | null;
  lastOrderAt: Date | null;
  /** Valid orders inside the selected period. */
  periodOrders: number;
  periodRevenue: number;
  /** Any order, any status — used only for "activity" dates. */
  firstAnyOrderAt: Date | null;
  lastAnyOrderAt: Date | null;
  periodAnyOrders: number;
  cancelledOrders: number;
}

export function summarizeOrdersByCustomer(
  orders: AnalyticsOrder[],
  directory: CustomerDirectory,
  period?: AnalyticsPeriod
): Map<string, CustomerOrderSummary> {
  const summaries = new Map<string, CustomerOrderSummary>();

  for (const order of orders) {
    const identity = directory.ownerOf(order);
    let summary = summaries.get(identity.key);

    if (!summary) {
      summary = {
        identity,
        orderName: "",
        orderMobile: "",
        orders: 0,
        revenue: 0,
        firstOrderAt: null,
        lastOrderAt: null,
        periodOrders: 0,
        periodRevenue: 0,
        firstAnyOrderAt: null,
        lastAnyOrderAt: null,
        periodAnyOrders: 0,
        cancelledOrders: 0,
      };
      summaries.set(identity.key, summary);
    }

    const name = [order.firstName, order.lastName].filter(Boolean).join(" ");
    if (
      !summary.lastAnyOrderAt ||
      order.createdAt.getTime() >= summary.lastAnyOrderAt.getTime()
    ) {
      if (name) summary.orderName = name;
      if (order.mobile) summary.orderMobile = order.mobile;
    }

    summary.firstAnyOrderAt = earliest(summary.firstAnyOrderAt, order.createdAt);
    summary.lastAnyOrderAt = latest(summary.lastAnyOrderAt, order.createdAt);

    const inPeriod = period ? isInPeriod(order.createdAt, period) : false;
    if (inPeriod) summary.periodAnyOrders += 1;

    if (!order.isValid) {
      summary.cancelledOrders += 1;
      continue;
    }

    summary.orders += 1;
    summary.revenue += order.total;
    summary.firstOrderAt = earliest(summary.firstOrderAt, order.createdAt);
    summary.lastOrderAt = latest(summary.lastOrderAt, order.createdAt);

    if (inPeriod) {
      summary.periodOrders += 1;
      summary.periodRevenue += order.total;
    }
  }

  for (const summary of summaries.values()) {
    summary.revenue = roundMoney(summary.revenue);
    summary.periodRevenue = roundMoney(summary.periodRevenue);
  }

  return summaries;
}

/* --------------------------------------------------------------------------
 * Behaviour — tracked events
 * ------------------------------------------------------------------------ */

export interface BehaviourEvent {
  event: string;
  userId: string;
  sessionId: string;
  createdAt: Date;
  productId: string;
  path: string;
  searchQuery: string;
  metadata: Document;
}

export const EVENT_PROJECTION = {
  event: 1,
  userId: 1,
  sessionId: 1,
  createdAt: 1,
  productId: 1,
  path: 1,
  searchQuery: 1,
  metadata: 1,
};

export function toBehaviourEvent(document: Document): BehaviourEvent | null {
  const createdAt = toValidDate(document.createdAt);
  if (!createdAt) return null;

  return {
    event: cleanText(document.event),
    userId: cleanText(document.userId),
    sessionId: cleanText(document.sessionId),
    createdAt,
    productId: cleanText(document.productId),
    path: cleanText(document.path),
    searchQuery: cleanText(document.searchQuery),
    metadata:
      document.metadata && typeof document.metadata === "object"
        ? document.metadata
        : {},
  };
}

export async function loadEvents(
  db: Db,
  filter: Document,
  projection: Document = EVENT_PROJECTION
): Promise<BehaviourEvent[]> {
  const documents = await db
    .collection("userEvents")
    .find(filter, { projection })
    .sort({ createdAt: 1 })
    .toArray();

  return documents
    .map((document) => toBehaviourEvent(document))
    .filter((event): event is BehaviourEvent => Boolean(event));
}

export interface BehaviourSummary {
  events: number;
  sessions: number;
  productViews: number;
  wishlistAdds: number;
  cartAdds: number;
  checkoutStarts: number;
  searches: number;
  firstAt: Date | null;
  lastAt: Date | null;
  lastCartAt: Date | null;
}

export function emptyBehaviour(): BehaviourSummary {
  return {
    events: 0,
    sessions: 0,
    productViews: 0,
    wishlistAdds: 0,
    cartAdds: 0,
    checkoutStarts: 0,
    searches: 0,
    firstAt: null,
    lastAt: null,
    lastCartAt: null,
  };
}

/** Counts each customer's behaviour. keyOf returns the customer key or null. */
export function summarizeBehaviour(
  events: BehaviourEvent[],
  keyOf: (event: BehaviourEvent) => string | null
): Map<string, BehaviourSummary> {
  const summaries = new Map<string, BehaviourSummary>();
  const sessions = new Map<string, Set<string>>();

  for (const event of events) {
    const key = keyOf(event);
    if (!key) continue;

    let summary = summaries.get(key);
    if (!summary) {
      summary = emptyBehaviour();
      summaries.set(key, summary);
      sessions.set(key, new Set());
    }

    summary.events += 1;
    if (event.sessionId) sessions.get(key)!.add(event.sessionId);

    switch (event.event) {
      case "product_view":
        summary.productViews += 1;
        break;
      case "wishlist_add":
        summary.wishlistAdds += 1;
        break;
      case "cart_add":
        summary.cartAdds += 1;
        summary.lastCartAt = latest(summary.lastCartAt, event.createdAt);
        break;
      case "checkout_start":
        summary.checkoutStarts += 1;
        break;
      case "search":
        summary.searches += 1;
        break;
      default:
        break;
    }

    summary.firstAt = earliest(summary.firstAt, event.createdAt);
    summary.lastAt = latest(summary.lastAt, event.createdAt);
  }

  for (const [key, summary] of summaries) {
    summary.sessions = sessions.get(key)?.size ?? 0;
  }

  return summaries;
}

/** Mongo condition: the field is present and not empty. */
export const PRESENT_VALUE: Document = { $exists: true, $nin: ["", null] };
const SIGNED_IN_EVENT = PRESENT_VALUE;

const ANONYMOUS_EVENT: Document[] = [
  { userId: { $exists: false } },
  { userId: null },
  { userId: "" },
];

/** Mongo filter: events recorded without a signed-in customer. */
export function anonymousEventFilter(): Document {
  return { $or: ANONYMOUS_EVENT.map((condition) => ({ ...condition })) };
}

/** First / last tracked event of each account (all time). */
export async function loadEventBoundsByUser(
  db: Db,
  userIds?: string[]
): Promise<Map<string, { firstAt: Date; lastAt: Date }>> {
  const bounds = new Map<string, { firstAt: Date; lastAt: Date }>();
  if (userIds && userIds.length === 0) return bounds;

  const rows = await db
    .collection("userEvents")
    .aggregate([
      { $match: { userId: userIds ? { $in: userIds } : SIGNED_IN_EVENT } },
      {
        $group: {
          _id: "$userId",
          firstAt: { $min: "$createdAt" },
          lastAt: { $max: "$createdAt" },
        },
      },
    ])
    .toArray();

  for (const row of rows) {
    const id = cleanText(row._id);
    const firstAt = toValidDate(row.firstAt);
    const lastAt = toValidDate(row.lastAt);
    if (id && firstAt && lastAt) bounds.set(id, { firstAt, lastAt });
  }

  return bounds;
}

/* --------------------------------------------------------------------------
 * Visitor identity (signed-in customer, or a guest browser session)
 * ------------------------------------------------------------------------ */

/**
 * Maps each browser session to the account that used it. When a session
 * was used by more than one account, the account seen last wins.
 */
export function buildSessionUserMap(
  pairs: { sessionId: string; userId: string; at: Date }[]
): Map<string, string> {
  const owners = new Map<string, { userId: string; at: number }>();

  for (const pair of pairs) {
    if (!pair.sessionId || !pair.userId) continue;
    const current = owners.get(pair.sessionId);
    const at = pair.at.getTime();
    if (
      !current ||
      at > current.at ||
      (at === current.at && pair.userId > current.userId)
    ) {
      owners.set(pair.sessionId, { userId: pair.userId, at });
    }
  }

  return new Map(
    Array.from(owners.entries()).map(([sessionId, owner]) => [
      sessionId,
      owner.userId,
    ])
  );
}

/** Session → account pairs seen in the period (signed-in events only). */
export async function loadSessionUserMap(
  db: Db,
  period: AnalyticsPeriod
): Promise<Map<string, string>> {
  const rows = await db
    .collection("userEvents")
    .aggregate([
      {
        $match: {
          ...periodCreatedAtFilter(period),
          userId: SIGNED_IN_EVENT,
          sessionId: SIGNED_IN_EVENT,
        },
      },
      {
        $group: {
          _id: { sessionId: "$sessionId", userId: "$userId" },
          at: { $max: "$createdAt" },
        },
      },
    ])
    .toArray();

  return buildSessionUserMap(
    rows
      .map((row) => ({
        sessionId: cleanText(row._id?.sessionId),
        userId: cleanText(row._id?.userId),
        at: toValidDate(row.at) ?? new Date(0),
      }))
      .filter((pair) => pair.sessionId && pair.userId)
  );
}

export function visitorKey(
  userId: string,
  sessionId: string,
  sessionUsers: Map<string, string>
): string {
  if (userId) return userKey(userId);
  if (sessionId) {
    const owner = sessionUsers.get(sessionId);
    return owner ? userKey(owner) : `session:${sessionId}`;
  }
  return "";
}

/** The visitor who placed an order — matches the identity of their browsing. */
export function orderVisitorKey(
  order: AnalyticsOrder,
  sessionUsers: Map<string, string>,
  directory: CustomerDirectory
): string {
  if (order.userId) return userKey(order.userId);
  if (order.sessionId) return visitorKey("", order.sessionId, sessionUsers);
  return directory.ownerOf(order).key;
}

/* --------------------------------------------------------------------------
 * Engagement score — ONE formula for every page
 * ------------------------------------------------------------------------ */

export interface EngagementScoreInput {
  sessions: number;
  productViews: number;
  wishlistAdds: number;
  cartAdds: number;
  orders: number;
  revenue: number;
}

export const ENGAGEMENT_SCORE_RULE =
  "Selected period: sessions × 2 + product views × 1 + wishlist adds × 4 + cart adds × 7 + orders × 20 + revenue bonus (₹5,000+ = 8, any revenue = 4), capped at 100.";

export function calculateEngagementScore(input: EngagementScoreInput): number {
  const revenueBonus = input.revenue >= 5000 ? 8 : input.revenue > 0 ? 4 : 0;

  const score =
    input.sessions * 2 +
    input.productViews +
    input.wishlistAdds * 4 +
    input.cartAdds * 7 +
    input.orders * 20 +
    revenueBonus;

  return Math.max(0, Math.min(100, Math.round(score)));
}

/* --------------------------------------------------------------------------
 * Customer segments — ONE classifier for every page
 * ------------------------------------------------------------------------ */

export const HIGH_VALUE_MIN_REVENUE = 10000;
export const LOYAL_MIN_ORDERS = 2;
export const HIGHLY_ENGAGED_MIN_SCORE = 40;
export const ACTIVE_BROWSER_MIN_VIEWS = 3;
export const WISHLIST_HEAVY_MIN_ADDS = 2;

export type SegmentKey =
  | "high-value"
  | "loyal"
  | "cart-abandoners"
  | "wishlist-heavy"
  | "highly-engaged"
  | "browsers";

export interface SegmentInput {
  /** Selected-period behaviour and orders. */
  period: {
    active: boolean;
    sessions: number;
    productViews: number;
    wishlistAdds: number;
    cartAdds: number;
    orders: number;
    revenue: number;
    lastCartAt: Date | null;
  };
  /** Lifetime value (valid orders). */
  lifetime: {
    orders: number;
    revenue: number;
    lastOrderAt: Date | null;
  };
  engagementScore: number;
}

export interface SegmentDefinition {
  key: SegmentKey;
  label: string;
  scope: "lifetime" | "period";
  description: string;
  matches: (input: SegmentInput) => boolean;
}

/** In priority order — the first match is the customer's primary segment. */
export const SEGMENT_DEFINITIONS: SegmentDefinition[] = [
  {
    key: "high-value",
    label: "High Value",
    scope: "lifetime",
    description: "Lifetime revenue of ₹10,000 or more.",
    matches: (input) => input.lifetime.revenue >= HIGH_VALUE_MIN_REVENUE,
  },
  {
    key: "loyal",
    label: "Loyal Customers",
    scope: "lifetime",
    description: "Two or more lifetime orders.",
    matches: (input) => input.lifetime.orders >= LOYAL_MIN_ORDERS,
  },
  {
    key: "cart-abandoners",
    label: "Cart Abandoners",
    scope: "period",
    description:
      "Added to cart in the selected period and has not placed an order since their latest cart activity.",
    matches: (input) =>
      input.period.cartAdds > 0 &&
      input.period.lastCartAt !== null &&
      (!input.lifetime.lastOrderAt ||
        input.lifetime.lastOrderAt.getTime() <
          input.period.lastCartAt.getTime()),
  },
  {
    key: "wishlist-heavy",
    label: "Wishlist Heavy",
    scope: "period",
    description:
      "Saved 2+ products to the wishlist in the selected period without adding anything to cart.",
    matches: (input) =>
      input.period.wishlistAdds >= WISHLIST_HEAVY_MIN_ADDS &&
      input.period.cartAdds === 0,
  },
  {
    key: "highly-engaged",
    label: "Highly Engaged",
    scope: "period",
    description: "Engagement score of 40 or more in the selected period.",
    matches: (input) => input.engagementScore >= HIGHLY_ENGAGED_MIN_SCORE,
  },
  {
    key: "browsers",
    label: "Active Browsers",
    scope: "period",
    description:
      "Viewed 3+ products in the selected period without wishlist, cart or order activity.",
    matches: (input) =>
      input.period.productViews >= ACTIVE_BROWSER_MIN_VIEWS &&
      input.period.wishlistAdds === 0 &&
      input.period.cartAdds === 0 &&
      input.period.orders === 0,
  },
];

export const SEGMENT_KEYS = SEGMENT_DEFINITIONS.map((definition) => definition.key);

export function isSegmentKey(value: unknown): value is SegmentKey {
  return SEGMENT_KEYS.includes(value as SegmentKey);
}

export function publicSegmentDefinitions() {
  return SEGMENT_DEFINITIONS.map(({ key, label, scope, description }) => ({
    key,
    label,
    scope,
    description,
  }));
}

export function getCustomerSegments(input: SegmentInput): SegmentKey[] {
  return SEGMENT_DEFINITIONS.filter((definition) =>
    definition.matches(input)
  ).map((definition) => definition.key);
}

export function classifyPrimarySegment(
  input: SegmentInput
): { key: SegmentKey | "active" | "inactive"; label: string } {
  const match = SEGMENT_DEFINITIONS.find((definition) =>
    definition.matches(input)
  );

  if (match) return { key: match.key, label: match.label };

  return input.period.active
    ? { key: "active", label: "Active Customer" }
    : { key: "inactive", label: "Inactive in Period" };
}

/* --------------------------------------------------------------------------
 * Customer analytics — the row every User page shows for a customer
 * ------------------------------------------------------------------------ */

export interface CustomerAnalytics {
  key: string;
  userId: string | null;
  isGuest: boolean;
  name: string;
  email: string;
  mobile: string;
  joinedAt: string | null;
  firstActiveAt: string | null;
  lastActiveAt: string | null;
  period: {
    active: boolean;
    sessions: number;
    productViews: number;
    wishlistAdds: number;
    cartAdds: number;
    checkoutStarts: number;
    orders: number;
    revenue: number;
    lastActiveAt: string | null;
  };
  lifetime: {
    orders: number;
    revenue: number;
    averageOrderValue: number;
    firstOrderAt: string | null;
    lastOrderAt: string | null;
  };
  engagementScore: number;
  segment: { key: string; label: string };
  segments: SegmentKey[];
}

export interface BuildCustomerInput {
  identity: CustomerIdentity;
  user?: UserLite | null;
  orderSummary?: CustomerOrderSummary | null;
  /** Behaviour inside the selected period. */
  behaviour?: BehaviourSummary | null;
  /** First / last tracked event of all time. */
  eventBounds?: { firstAt: Date | null; lastAt: Date | null } | null;
}

export function buildCustomerAnalytics(input: BuildCustomerInput): CustomerAnalytics {
  const { identity, user, orderSummary } = input;
  const behaviour = input.behaviour ?? emptyBehaviour();

  const lifetimeOrders = orderSummary?.orders ?? 0;
  const lifetimeRevenue = orderSummary?.revenue ?? 0;
  const periodOrders = orderSummary?.periodOrders ?? 0;
  const periodRevenue = orderSummary?.periodRevenue ?? 0;

  const periodActive =
    behaviour.events > 0 || (orderSummary?.periodAnyOrders ?? 0) > 0;

  const engagementScore = calculateEngagementScore({
    sessions: behaviour.sessions,
    productViews: behaviour.productViews,
    wishlistAdds: behaviour.wishlistAdds,
    cartAdds: behaviour.cartAdds,
    orders: periodOrders,
    revenue: periodRevenue,
  });

  const segmentInput: SegmentInput = {
    period: {
      active: periodActive,
      sessions: behaviour.sessions,
      productViews: behaviour.productViews,
      wishlistAdds: behaviour.wishlistAdds,
      cartAdds: behaviour.cartAdds,
      orders: periodOrders,
      revenue: periodRevenue,
      lastCartAt: behaviour.lastCartAt,
    },
    lifetime: {
      orders: lifetimeOrders,
      revenue: lifetimeRevenue,
      lastOrderAt: orderSummary?.lastOrderAt ?? null,
    },
    engagementScore,
  };

  const userName = user
    ? [user.firstName, user.lastName].filter(Boolean).join(" ")
    : "";

  const periodLastActive = latest(
    behaviour.lastAt,
    orderSummary && orderSummary.periodAnyOrders > 0
      ? orderSummary.lastAnyOrderAt
      : null
  );

  return {
    key: identity.key,
    userId: identity.userId,
    isGuest: identity.isGuest,
    name: userName || orderSummary?.orderName || (identity.isGuest ? "Guest customer" : "Customer"),
    email: user?.email || identity.email,
    mobile: user?.mobile || orderSummary?.orderMobile || "",
    joinedAt: toIso(user ? user.createdAt : orderSummary?.firstAnyOrderAt ?? null),
    firstActiveAt: toIso(
      earliest(input.eventBounds?.firstAt, orderSummary?.firstAnyOrderAt)
    ),
    lastActiveAt: toIso(
      latest(input.eventBounds?.lastAt, orderSummary?.lastAnyOrderAt)
    ),
    period: {
      active: periodActive,
      sessions: behaviour.sessions,
      productViews: behaviour.productViews,
      wishlistAdds: behaviour.wishlistAdds,
      cartAdds: behaviour.cartAdds,
      checkoutStarts: behaviour.checkoutStarts,
      orders: periodOrders,
      revenue: periodRevenue,
      lastActiveAt: toIso(periodLastActive),
    },
    lifetime: {
      orders: lifetimeOrders,
      revenue: lifetimeRevenue,
      averageOrderValue:
        lifetimeOrders > 0 ? roundMoney(lifetimeRevenue / lifetimeOrders) : 0,
      firstOrderAt: toIso(orderSummary?.firstOrderAt ?? null),
      lastOrderAt: toIso(orderSummary?.lastOrderAt ?? null),
    },
    engagementScore,
    segment: classifyPrimarySegment(segmentInput),
    segments: getCustomerSegments(segmentInput),
  };
}

/* --------------------------------------------------------------------------
 * Guest activity — guests have no account, so their browsing is the
 * anonymous activity of the browser sessions that placed their orders.
 * ------------------------------------------------------------------------ */

export function guestSessionOwners(
  orders: AnalyticsOrder[],
  directory: CustomerDirectory,
  guestKeys?: Set<string>
): Map<string, string> {
  const owners = new Map<string, string>();

  // Oldest → newest over ALL guest orders, so the latest guest order for a
  // session wins no matter which guests are being looked at.
  const sorted = [...orders].sort(
    (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
  );

  for (const order of sorted) {
    if (!order.sessionId) continue;
    const owner = directory.ownerOf(order);
    if (!owner.isGuest) continue;
    owners.set(order.sessionId, owner.key);
  }

  if (guestKeys) {
    for (const [sessionId, owner] of owners) {
      if (!guestKeys.has(owner)) owners.delete(sessionId);
    }
  }

  return owners;
}

async function loadGuestActivity(
  db: Db,
  period: AnalyticsPeriod,
  sessionOwners: Map<string, string>
): Promise<{
  behaviour: Map<string, BehaviourSummary>;
  bounds: Map<string, { firstAt: Date | null; lastAt: Date | null }>;
}> {
  const sessionIds = Array.from(sessionOwners.keys());

  if (sessionIds.length === 0) {
    return { behaviour: new Map(), bounds: new Map() };
  }

  const [periodEvents, boundRows] = await Promise.all([
    loadEvents(
      db,
      {
        ...periodCreatedAtFilter(period),
        sessionId: { $in: sessionIds },
        $or: ANONYMOUS_EVENT,
      },
      { event: 1, userId: 1, sessionId: 1, createdAt: 1 }
    ),
    db
      .collection("userEvents")
      .aggregate([
        { $match: { sessionId: { $in: sessionIds }, $or: ANONYMOUS_EVENT } },
        {
          $group: {
            _id: "$sessionId",
            firstAt: { $min: "$createdAt" },
            lastAt: { $max: "$createdAt" },
          },
        },
      ])
      .toArray(),
  ]);

  const behaviour = summarizeBehaviour(
    periodEvents,
    (event) => sessionOwners.get(event.sessionId) ?? null
  );

  const bounds = new Map<string, { firstAt: Date | null; lastAt: Date | null }>();
  for (const row of boundRows) {
    const owner = sessionOwners.get(cleanText(row._id));
    if (!owner) continue;
    const current = bounds.get(owner) ?? { firstAt: null, lastAt: null };
    current.firstAt = earliest(current.firstAt, toValidDate(row.firstAt));
    current.lastAt = latest(current.lastAt, toValidDate(row.lastAt));
    bounds.set(owner, current);
  }

  return { behaviour, bounds };
}

export interface CustomerScope {
  /** Accounts to include ("all" = every account). */
  userIds: string[] | "all";
  /** Guest checkouts to include, by customer key ("all" / "none"). */
  guestKeys: string[] | "all" | "none";
  /** Keep only customers with activity or an order in the period. */
  onlyActiveInPeriod?: boolean;
}

export interface CustomerAnalyticsResult {
  customers: CustomerAnalytics[];
  directory: CustomerDirectory;
  orders: AnalyticsOrder[];
  orderSummaries: Map<string, CustomerOrderSummary>;
}

/**
 * Builds the customer rows used by Overview, Customer Profiles and Segments.
 * Money comes from orders (lifetime + selected period); behaviour comes from
 * tracked events in the selected period.
 */
export async function loadCustomerAnalytics(
  db: Db,
  period: AnalyticsPeriod,
  scope: CustomerScope
): Promise<CustomerAnalyticsResult> {
  const scopeUsers =
    scope.userIds === "all"
      ? await loadUsers(db)
      : scope.userIds.length > 0
        ? await loadUsers(db, { id: { $in: scope.userIds } })
        : [];

  const orders = await loadOrders(db);
  const directory = await loadDirectoryForOrders(db, orders, scopeUsers);
  const orderSummaries = summarizeOrdersByCustomer(orders, directory, period);

  const scopedUserIds =
    scope.userIds === "all" ? undefined : scopeUsers.map((user) => user.id);

  const guestKeySet =
    scope.guestKeys === "none"
      ? new Set<string>()
      : new Set(
          Array.from(orderSummaries.keys()).filter(
            (key) =>
              key.startsWith("guest:") &&
              (scope.guestKeys === "all" || scope.guestKeys.includes(key))
          )
        );

  const [periodEvents, eventBounds, guestActivity] = await Promise.all([
    scopedUserIds && scopedUserIds.length === 0
      ? Promise.resolve([] as BehaviourEvent[])
      : loadEvents(
          db,
          {
            ...periodCreatedAtFilter(period),
            userId: scopedUserIds ? { $in: scopedUserIds } : SIGNED_IN_EVENT,
          },
          { event: 1, userId: 1, sessionId: 1, createdAt: 1 }
        ),
    loadEventBoundsByUser(db, scopedUserIds),
    loadGuestActivity(
      db,
      period,
      guestSessionOwners(orders, directory, guestKeySet)
    ),
  ]);

  const userBehaviour = summarizeBehaviour(periodEvents, (event) =>
    event.userId ? userKey(event.userId) : null
  );

  const customers: CustomerAnalytics[] = [];

  for (const user of scopeUsers) {
    const key = userKey(user.id);
    customers.push(
      buildCustomerAnalytics({
        identity: directory.userIdentity(user),
        user,
        orderSummary: orderSummaries.get(key),
        behaviour: userBehaviour.get(key),
        eventBounds: eventBounds.get(user.id),
      })
    );
  }

  for (const key of guestKeySet) {
    const summary = orderSummaries.get(key)!;
    customers.push(
      buildCustomerAnalytics({
        identity: summary.identity,
        orderSummary: summary,
        behaviour: guestActivity.behaviour.get(key),
        eventBounds: guestActivity.bounds.get(key),
      })
    );
  }

  return {
    customers: scope.onlyActiveInPeriod
      ? customers.filter((customer) => customer.period.active)
      : customers,
    directory,
    orders,
    orderSummaries,
  };
}

/* --------------------------------------------------------------------------
 * Customer search (database side)
 * ------------------------------------------------------------------------ */

/** Mongo filter matching every search word against the given fields. */
export function buildSearchFilter(search: string, fields: string[]): Document | null {
  const words = search
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 6);

  if (words.length === 0) return null;

  return {
    $and: words.map((word) => {
      const pattern = new RegExp(escapeRegex(word), "i");
      return { $or: fields.map((field) => ({ [field]: pattern })) };
    }),
  };
}

export const USER_SEARCH_FIELDS = ["email", "firstName", "lastName", "id", "mobile"];

export const ORDER_SEARCH_FIELDS = [
  "customer.email",
  "customer.firstName",
  "customer.lastName",
  "customer.mobile",
];

/* --------------------------------------------------------------------------
 * Products
 * ------------------------------------------------------------------------ */

export interface ProductLite {
  id: string;
  name: string;
  slug: string;
  category: string;
  image: string;
}

export async function loadProductsById(
  db: Db,
  ids?: string[]
): Promise<Map<string, ProductLite>> {
  const products = new Map<string, ProductLite>();
  if (ids && ids.length === 0) return products;

  const documents = await db
    .collection("products")
    .find(ids ? { id: { $in: ids } } : {}, {
      projection: { _id: 0, id: 1, name: 1, slug: 1, category: 1, images: 1 },
    })
    .toArray();

  for (const document of documents) {
    const id = cleanText(document.id);
    if (!id) continue;
    products.set(id, {
      id,
      name: cleanText(document.name) || "Untitled product",
      slug: cleanText(document.slug),
      category: cleanText(document.category) || "Uncategorized",
      image:
        Array.isArray(document.images) && document.images.length > 0
          ? cleanText(document.images[0])
          : "",
    });
  }

  return products;
}
