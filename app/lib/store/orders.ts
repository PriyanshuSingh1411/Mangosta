import "server-only";

import { randomBytes } from "crypto";
import clientPromise from "@/app/lib/mongodb";
import type { ClientSession } from "mongodb";
import { canChangeOrderStatus } from "@/app/data/storeTypes";
import { ORDERS_PATH, getDb, isDuplicateKeyError, isMigrated, markMigrated, omitMongoId, readJson, supportsTransactions, wait, warnOnceNoTransactions } from "./core";
import { InsufficientInventoryError, atomicDecrementInventory, buildInventoryRequests, restockLines, restoreInventory, toUnavailable } from "./inventory";
import type { InventoryRequest, UnavailableProduct } from "./inventory";
import { couponCustomerOf, normalizeCouponCode, redeemCoupon, releaseCoupon } from "./coupons";
import type { CouponDocument } from "./coupons";

// Orders: types, placing orders (stock + coupon + unpaid-order limit in one
// step), customer order queries, cancellations and status changes.

type OrderDocument = Order & {
  _id: string;
};

// ============================================================
// ORDERS
// ============================================================

export type PaymentMethod = "cod" | "online" | "card";

export type PaymentStatus =
  | "pending"
  | "paid"
  | "failed";

export interface OrderLine {
  lineId: string;
  productId: string;
  productName: string;
  slug: string;
  image: string;
  size: string;
  color: string;
  quantity: number;
  price: number; // Price paid (after discount)
  // Historical pricing snapshot at time of order
  originalPrice?: number; // Base price before discount
  discountPercent?: number; // Discount % applied
  compareAtPrice?: number; // Compare-at price if available
}

export type OrderStatus =
  | "pending"
  | "shipped"
  | "delivered"
  | "cancelled";

export const ORDER_STATUSES: OrderStatus[] = [
  "pending",
  "shipped",
  "delivered",
  "cancelled",
];

/** Courier details entered by the admin when an order is shipped. */
export interface OrderShipment {
  courier: string;
  trackingNumber: string;
  trackingUrl: string;
  shippedAt: string;
}

export interface Order {
  id: string;
  createdAt: string;

  /** "fulfilled" from older data is read as "delivered". */
  status: OrderStatus;

  shipment?: OrderShipment;
  deliveredAt?: string;
  cancelledAt?: string;
  /** Who cancelled it, and the customer's reason (optional). */
  cancelledBy?: "customer" | "admin";
  cancelReason?: string;
  /** Cancelled after shipping because the parcel came back to us (RTO). */
  returnedToSender?: boolean;
  /** Set when a cancel put the stock back, so it never happens twice. */
  stockRestored?: boolean;

  customer: {
    email: string;
    firstName: string;
    lastName: string;
    address: string;
    city: string;
    state: string;
    postalCode: string;
    mobile: string;
  };

  lines: OrderLine[];

  subtotal: number;
  shipping: number;
  discount?: number;
  couponCode?: string;
  total: number;

  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;

  /**
   * Signed-in account that placed the order (orders placed as a guest
   * have none). Used by the admin User analytics to link orders to
   * customers; older orders are linked by email.
   */
  userId?: string;

  /** Browser engagement session that placed the order (analytics only). */
  engagementSessionId?: string;
}

// ============================================================
// ORDERS
// ============================================================

async function migrateOrdersFromJson(): Promise<void> {
  const migrationId = "orders-json-to-mongodb";
  if (await isMigrated(migrationId)) {
    return;
  }

  const db = await getDb();
  const collection = db.collection<OrderDocument>("orders");

  if ((await collection.countDocuments()) === 0) {
    const legacyOrders = await readJson<Order[]>(
      ORDERS_PATH,
      []
    );

    if (legacyOrders.length > 0) {
      const documents: OrderDocument[] = legacyOrders.map(
        (order) => ({
          ...order,
          _id: order.id,
          customer: {
            ...order.customer,
            mobile: String(
              order.customer?.mobile ?? ""
            ),
          },
        })
      );

      await collection.insertMany(documents);
    }
  }

  await markMigrated(migrationId);
}

function normalizeOrderStatus(value: unknown): OrderStatus {
  if (value === "fulfilled") return "delivered"; // older data
  return ORDER_STATUSES.includes(value as OrderStatus)
    ? (value as OrderStatus)
    : "pending";
}

function normalizeShipment(value: unknown): OrderShipment | undefined {
  if (!value || typeof value !== "object") return undefined;
  const source = value as Partial<OrderShipment>;

  return {
    courier: String(source.courier ?? ""),
    trackingNumber: String(source.trackingNumber ?? ""),
    trackingUrl: String(source.trackingUrl ?? ""),
    shippedAt: String(source.shippedAt ?? ""),
  };
}

export async function getOrders(): Promise<Order[]> {
  await migrateOrdersFromJson();

  const db = await getDb();
  const collection = db.collection<OrderDocument>("orders");

  const documents = await collection
    .find({})
    .sort({ createdAt: -1 })
    .toArray();

  return documents.map(toOrder);
}

/** A stored order document, before it's cleaned up by toOrder(). */
type OrderRecord = { _id: string } & Record<string, unknown>;

// ------------------------------------------------------------
// One customer's orders (customer pages: never load every order)
// ------------------------------------------------------------

/** The signed-in customer an order must belong to. */
export interface OrderOwner {
  userId?: string;
  email: string;
}

let orderIndexes: Promise<void> | null = null;

/** Indexes for per-customer order lookups (created once per server). */
function ensureOrderIndexes(): Promise<void> {
  if (!orderIndexes) {
    orderIndexes = getDb()
      .then((db) =>
        Promise.all([
          db.collection("orders").createIndex({ userId: 1, status: 1 }),
          db.collection("orders").createIndex({ "customer.email": 1 }),
        ])
      )
      .then(() => undefined)
      .catch((error) => {
        // Only slower without them; try again next time.
        orderIndexes = null;
        console.warn(
          "[ORDERS] Could not create the orders userId / email indexes.",
          error instanceof Error ? error.message : error
        );
      });
  }
  return orderIndexes;
}

/**
 * One-time: order emails are stored lowercased and trimmed (checkout has
 * done this for a long time; very old orders may not be), so a customer's
 * orders can be found with an exact, indexed match.
 */
async function normalizeStoredOrderEmails(): Promise<void> {
  const migrationId = "orders-email-lowercase-v1";
  if (await isMigrated(migrationId)) return;

  const db = await getDb();
  const collection = db.collection<OrderRecord>("orders");
  const candidates = await collection
    .find(
      { "customer.email": { $regex: /[A-Z]|^\s|\s$/ } },
      { projection: { _id: 1, customer: 1 } }
    )
    .toArray();

  for (const order of candidates) {
    const email = String((order.customer as { email?: unknown } | undefined)?.email ?? "");
    await collection.updateOne(
      { _id: order._id },
      { $set: { "customer.email": email.trim().toLowerCase() } }
    );
  }

  await markMigrated(migrationId);
}

function ownerFilter(owner: OrderOwner): Record<string, unknown> {
  const email = owner.email.trim().toLowerCase();
  const or: Record<string, string>[] = [{ "customer.email": email }];
  if (owner.userId) or.unshift({ userId: owner.userId });
  return { $or: or };
}

/** True when the order was placed by this account (or with its email). */
export function orderBelongsTo(
  order: Pick<Order, "userId" | "customer">,
  owner: OrderOwner
): boolean {
  if (owner.userId && order.userId === owner.userId) return true;
  return (
    String(order.customer?.email ?? "").trim().toLowerCase() ===
    owner.email.trim().toLowerCase()
  );
}

/** The customer's orders, newest first. */
export async function getOrdersForCustomer(
  owner: OrderOwner,
  options: { limit?: number } = {}
): Promise<Order[]> {
  await migrateOrdersFromJson();
  await normalizeStoredOrderEmails();
  await ensureOrderIndexes();

  const db = await getDb();
  const cursor = db
    .collection<OrderRecord>("orders")
    .find(ownerFilter(owner))
    .sort({ createdAt: -1 });

  if (options.limit && options.limit > 0) cursor.limit(options.limit);

  return (await cursor.toArray()).map(toOrder);
}

/** True when the customer placed an order at or after `sinceIso`. */
export async function hasOrderSince(
  owner: OrderOwner,
  sinceIso: string
): Promise<boolean> {
  await migrateOrdersFromJson();
  await normalizeStoredOrderEmails();
  await ensureOrderIndexes();

  const db = await getDb();
  const found = await db
    .collection<OrderRecord>("orders")
    .findOne(
      { ...ownerFilter(owner), createdAt: { $gte: sinceIso } },
      { projection: { _id: 1 } }
    );
  return Boolean(found);
}

/**
 * The customer's orders that are still on their way (Processing or
 * Shipped). Used before an account is deleted.
 */
export async function countOpenOrdersForCustomer(
  owner: OrderOwner,
  session?: ClientSession
): Promise<number> {
  await migrateOrdersFromJson();
  await normalizeStoredOrderEmails();
  await ensureOrderIndexes();

  const db = await getDb();
  // Anything not finished counts (also old / unknown statuses, which the
  // customer sees as Processing).
  return db
    .collection<OrderRecord>("orders")
    .countDocuments(
      { ...ownerFilter(owner), status: { $nin: ["delivered", "cancelled", "fulfilled"] } },
      { session }
    );
}

/**
 * Account deleted: its orders are kept (sales / tax records) but no longer
 * belong to any login. Returns how many orders were unlinked.
 */
export async function unlinkOrdersFromAccount(
  userId: string,
  session?: ClientSession
): Promise<number> {
  if (!userId) return 0;
  const db = await getDb();
  const result = await db
    .collection<OrderRecord>("orders")
    .updateMany({ userId }, { $unset: { userId: "" } }, { session });
  return result.modifiedCount;
}

/** One of the customer's orders, or null (also when it isn't theirs). */
export async function getCustomerOrder(
  owner: OrderOwner,
  id: string
): Promise<Order | null> {
  const order = await getOrderById(id);
  return order && orderBelongsTo(order, owner) ? order : null;
}

/** Several orders by id (missing ids are skipped). */
export async function getOrdersByIds(ids: string[]): Promise<Order[]> {
  const unique = [...new Set(ids.filter(Boolean))];
  if (unique.length === 0) return [];

  await migrateOrdersFromJson();

  const db = await getDb();
  const documents = await db
    .collection<OrderRecord>("orders")
    .find({ _id: { $in: unique } })
    .toArray();

  return documents.map(toOrder);
}

/** One order, or null. */
export async function getOrderById(id: string): Promise<Order | null> {
  await migrateOrdersFromJson();

  const db = await getDb();
  const document = await db
    .collection<OrderRecord>("orders")
    .findOne({ _id: id });

  return document ? toOrder(document) : null;
}

function toOrder(document: Record<string, unknown>): Order {
    const order = omitMongoId(document) as Partial<Order>;

    return {
      ...order,

      id: String(order.id ?? ""),
      createdAt: String(
        order.createdAt ?? new Date().toISOString()
      ),

      status: normalizeOrderStatus(order.status),

      shipment: normalizeShipment(order.shipment),
      deliveredAt: order.deliveredAt
        ? String(order.deliveredAt)
        : undefined,
      cancelledAt: order.cancelledAt
        ? String(order.cancelledAt)
        : undefined,

      customer: {
        email: String(
          order.customer?.email ?? ""
        ),

        firstName: String(
          order.customer?.firstName ?? ""
        ),

        lastName: String(
          order.customer?.lastName ?? ""
        ),

        address: String(
          order.customer?.address ?? ""
        ),

        city: String(
          order.customer?.city ?? ""
        ),

        state: String(
          order.customer?.state ?? ""
        ),

        postalCode: String(
          order.customer?.postalCode ?? ""
        ),

        mobile: String(
          order.customer?.mobile ?? ""
        ),
      },

      lines: Array.isArray(order.lines)
        ? order.lines
        : [],

      subtotal: Number(order.subtotal) || 0,
      shipping: Number(order.shipping) || 0,
      discount: Number(order.discount) || 0,
      couponCode: order.couponCode
        ? String(order.couponCode)
        : undefined,
      total: Number(order.total) || 0,

      /*
       * Existing orders created before payment
       * fields were added are treated as COD/pending.
       */
      paymentMethod:
        order.paymentMethod === "online" ||
        order.paymentMethod === "card"
          ? order.paymentMethod
          : "cod",

      paymentStatus:
        order.paymentStatus === "paid" ||
        order.paymentStatus === "failed"
          ? order.paymentStatus
          : "pending",
    };
}

export async function saveOrders(
  orders: Order[]
): Promise<void> {
  const db = await getDb();
  const collection = db.collection<OrderDocument>("orders");

  const existing = await collection
    .find({}, { projection: { _id: 1, id: 1 } })
    .toArray();

  const incomingIds = new Set(
    orders.map((order) => order.id)
  );

  for (const stored of existing) {
    if (!incomingIds.has(stored.id)) {
      await collection.deleteOne({
        _id: stored._id,
      });
    }
  }

  for (const order of orders) {
    const document: OrderDocument = {
      ...order,
      _id: order.id,
      customer: {
        ...order.customer,
        mobile: String(
          order.customer?.mobile ?? ""
        ),
      },
    };

    await collection.replaceOne(
      { _id: order.id },
      document,
      { upsert: true }
    );
  }
}

export type NewOrderInput = Omit<
  Order,
  "id" | "createdAt" | "status"
>;

function generateOrderId(): string {
  const time = Date.now().toString(36).toUpperCase();
  const random = randomBytes(3).toString("hex").toUpperCase();

  return `MG-${time}-${random}`;
}

/**
 * Builds and saves an order document. That is ALL it does:
 * it never reads, changes or saves product inventory.
 *
 * Not exported on purpose — orders must be created through
 * placeOrder(), which reserves stock in the same operation.
 */
async function createOrder(
  order: NewOrderInput,
  session?: ClientSession
): Promise<Order> {
  const newOrder: Order = {
    ...order,

    customer: {
      ...order.customer,

      mobile: String(
        order.customer?.mobile ?? ""
      ),

      state: String(
        order.customer?.state ?? ""
      ),
    },

    paymentMethod:
      order.paymentMethod === "online" ||
      order.paymentMethod === "card"
        ? order.paymentMethod
        : "cod",

    paymentStatus:
      order.paymentStatus === "paid" ||
      order.paymentStatus === "failed"
        ? order.paymentStatus
        : "pending",

    id: generateOrderId(),

    createdAt:
      new Date().toISOString(),

    status: "pending",
  };

  const db = await getDb();

  const collection =
    db.collection<OrderDocument>("orders");

  await collection.insertOne(
    {
      ...newOrder,
      _id: newOrder.id,
    },
    { session }
  );

  return newOrder;
}

// ------------------------------------------------------------
// Unpaid order limit per account
// ------------------------------------------------------------

/**
 * Most UNPAID orders one account may have waiting to ship ("Processing"):
 * cash on delivery, and online / card orders whose payment is still
 * pending (there is no payment gateway confirming payments yet). A 6th is
 * refused until one of them ships or is cancelled. Orders marked "paid"
 * never count and are never limited.
 */
export const MAX_OPEN_UNPAID_ORDERS = 5;

/**
 * Thrown by placeOrder() when the account already has
 * MAX_OPEN_UNPAID_ORDERS unpaid orders in Processing. NO order exists and
 * stock and coupons are unchanged. The checkout API maps it to HTTP 429.
 */
export class UnpaidOrderLimitError extends Error {
  readonly limit: number;

  constructor(limit: number) {
    super(
      `You already have ${limit} orders waiting to ship that aren't paid yet (cash on delivery or payment pending). You can place a new order once one of them ships.`
    );

    this.name = "UnpaidOrderLimitError";
    this.limit = limit;
  }
}

/**
 * Only on a MongoDB server WITHOUT transactions (standalone local mongod):
 * another order for the same account kept the account lock for longer than
 * the wait time. Nothing was changed. The checkout API maps it to HTTP 409.
 */
export class OrderInProgressError extends Error {
  constructor() {
    super(
      "Another order is being placed on your account right now. Please try again in a moment."
    );

    this.name = "OrderInProgressError";
  }
}

const ORDER_LOCKS_COLLECTION = "orderLocks";
const ORDER_LOCK_HOLD_MS = 30_000;
const ORDER_LOCK_WAIT_MS = 10_000;
const ORDER_LOCK_RETRY_MS = 150;

type OrderLockDocument = {
  _id: string;
  version?: number;
  token?: string;
  lockedUntil?: Date;
  updatedAt?: Date;
};

interface OrderLimitTarget {
  lockId: string;
  userId?: string;
  email: string;
  /** Not paid yet → counts toward MAX_OPEN_UNPAID_ORDERS. */
  limitUnpaid: boolean;
}

/**
 * The account an order belongs to. Every order of an account takes the
 * account lock, so per-account rules (the unpaid-order limit and the
 * per-customer coupon rules) are checked one order at a time. Only orders
 * that aren't paid yet count toward the unpaid limit. Null when the order
 * has no owner at all.
 */
/**
 * The lock shared by everything that must happen one at a time for an
 * account: placing orders, creating return requests and deleting the
 * account (see runExclusive).
 */
export function accountLockId(userId: string | undefined, email: string): string {
  return userId
    ? `account-orders:user:${userId}`
    : `account-orders:email:${email.trim().toLowerCase()}`;
}

/**
 * The account was deleted while this request was on its way (it signed
 * in before). Nothing was changed. The checkout API maps it to HTTP 401.
 */
export class AccountClosedError extends Error {
  constructor() {
    super("Your account is no longer available. Please sign in again.");
    this.name = "AccountClosedError";
  }
}

/** Under the account lock: the account still exists. */
async function assertAccountStillExists(
  userId: string | undefined,
  session?: ClientSession
): Promise<void> {
  if (!userId) return;
  const db = await getDb();
  const user = await db
    .collection("users")
    .findOne({ id: userId }, { projection: { _id: 1 }, session });
  if (!user) throw new AccountClosedError();
}

function orderLimitTarget(
  order: NewOrderInput
): OrderLimitTarget | null {
  const userId = order.userId ? String(order.userId) : undefined;
  const email = String(order.customer?.email ?? "")
    .trim()
    .toLowerCase();

  if (!userId && !email) {
    return null;
  }

  return {
    lockId: accountLockId(userId, email),
    userId,
    email,
    limitUnpaid: order.paymentStatus !== "paid",
  };
}

/**
 * The account's unpaid orders that are still Processing. Matched by the
 * account id only: checkout links every order to the signed-in account,
 * so old guest orders that merely used this email (possibly typed in by
 * someone else) don't count against the customer.
 */
function openUnpaidOrdersFilter(target: OrderLimitTarget) {
  return {
    ...(target.userId
      ? { userId: target.userId }
      : { "customer.email": target.email }),
    paymentStatus: { $ne: "paid" },
    status: { $nin: NOT_PROCESSING_STATUSES },
  };
}

async function getOrderLocksCollection() {
  const db = await getDb();
  return db.collection<OrderLockDocument>(ORDER_LOCKS_COLLECTION);
}

/**
 * The lock document exists (so inside a transaction it is only updated,
 * never inserted: two transactions inserting the same new _id would fail
 * instead of waiting for each other).
 */
async function ensureLockDocument(lockId: string): Promise<void> {
  const locks = await getOrderLocksCollection();

  try {
    await locks.updateOne(
      { _id: lockId },
      { $setOnInsert: { version: 0, updatedAt: new Date() } },
      { upsert: true }
    );
  } catch (error) {
    // Two first-ever requests at the same moment: the other one created it.
    if (!isDuplicateKeyError(error)) throw error;
  }
}

/**
 * Before the transaction: the account's lock document exists and orders
 * are indexed by account (so the counts inside the transaction don't scan
 * every order).
 */
async function prepareOrderLimit(lockId: string): Promise<void> {
  await ensureOrderIndexes();
  await ensureLockDocument(lockId);
}

/**
 * Inside the order transaction (replica set / Atlas).
 *
 * 1. Writes the account's lock document. Two transactions for the same
 *    account can't both write it: the second gets a write conflict, is
 *    rolled back and re-run by withTransaction() AFTER the first one has
 *    committed - so it counts the first one's order too.
 * 2. Unpaid order: counts the account's unpaid orders still in Processing.
 * 3. Already MAX_OPEN_UNPAID_ORDERS → UnpaidOrderLimitError (full rollback).
 * The coupon's per-customer rules are checked later in the same
 * transaction, after this lock (see redeemCoupon).
 */
async function assertOrderLimitInTransaction(
  target: OrderLimitTarget,
  session: ClientSession
): Promise<void> {
  const locks = await getOrderLocksCollection();

  // upsert: still a write (and so still serialised) even if the lock
  // document was deleted after prepareOrderLimit() ran.
  await locks.updateOne(
    { _id: target.lockId },
    { $inc: { version: 1 }, $set: { updatedAt: new Date() } },
    { upsert: true, session }
  );

  await assertAccountStillExists(target.userId, session);

  if (!target.limitUnpaid) {
    return;
  }

  const db = await getDb();
  const openUnpaidOrders = await db
    .collection("orders")
    .countDocuments(openUnpaidOrdersFilter(target), { session });

  if (openUnpaidOrders >= MAX_OPEN_UNPAID_ORDERS) {
    throw new UnpaidOrderLimitError(MAX_OPEN_UNPAID_ORDERS);
  }
}

/**
 * Without transactions (standalone local mongod only): a short lock per
 * account so two orders from the same account are placed one after the
 * other. The lock frees itself after ORDER_LOCK_HOLD_MS if a request dies
 * while holding it. Returns the function that releases it.
 */
async function acquireOrderLock(
  lockId: string
): Promise<() => Promise<void>> {
  const locks = await getOrderLocksCollection();
  const token = randomBytes(12).toString("hex");
  const giveUpAt = Date.now() + ORDER_LOCK_WAIT_MS;

  for (;;) {
    const now = new Date();

    try {
      // Free (never locked, released, or expired) → take it. Held by
      // another request → no match → the upsert's insert hits the
      // existing _id → duplicate key → wait and try again.
      const result = await locks.updateOne(
        {
          _id: lockId,
          $or: [
            { lockedUntil: { $exists: false } },
            { lockedUntil: { $lte: now } },
          ],
        },
        {
          $set: {
            token,
            lockedUntil: new Date(now.getTime() + ORDER_LOCK_HOLD_MS),
            updatedAt: now,
          },
        },
        { upsert: true }
      );

      if (result.modifiedCount === 1 || result.upsertedCount === 1) {
        return async () => {
          try {
            await locks.updateOne(
              { _id: lockId, token },
              { $unset: { token: "", lockedUntil: "" } }
            );
          } catch (error) {
            // Not fatal: the lock expires on its own.
            console.error(`[ORDERS] Could not release order lock ${lockId}.`, error);
          }
        };
      }
    } catch (error) {
      if (!isDuplicateKeyError(error)) throw error;
    }

    if (Date.now() >= giveUpAt) {
      throw new OrderInProgressError();
    }

    await wait(ORDER_LOCK_RETRY_MS);
  }
}

/**
 * Runs `work` for one lock id at a time (e.g. one order's return
 * requests), so a check-then-save inside it can't race with another
 * request for the same id.
 *
 * - Replica set / Atlas: inside a transaction that first writes the lock
 *   document. A second transaction for the same id gets a write conflict
 *   and is re-run by withTransaction() after the first commits, so it
 *   sees the first one's writes. `work` receives the session and must use
 *   it for its reads and writes, and must be safe to run again.
 * - Standalone mongod (local only): the short lock used for orders.
 */
export async function runExclusive<T>(
  lockId: string,
  work: (session?: ClientSession) => Promise<T>
): Promise<T> {
  if (await supportsTransactions()) {
    await ensureLockDocument(lockId);
    const locks = await getOrderLocksCollection();
    const client = await clientPromise;
    const session = client.startSession();

    try {
      let result!: T;
      await session.withTransaction(async () => {
        await locks.updateOne(
          { _id: lockId },
          { $inc: { version: 1 }, $set: { updatedAt: new Date() } },
          { upsert: true, session }
        );
        result = await work(session);
      });
      return result;
    } finally {
      await session.endSession();
    }
  }

  const release = await acquireOrderLock(lockId);
  try {
    return await work();
  } finally {
    await release();
  }
}

/**
 * Places an order as ONE all-or-nothing operation:
 *
 *   BEGIN TRANSACTION
 *     not paid yet?    → lock the account and count its unpaid orders
 *                         still in Processing; MAX_OPEN_UNPAID_ORDERS
 *                         already → abort, throw UnpaidOrderLimitError
 *     decrement stock for every product in the cart (atomic, conditional)
 *     any product short?  → abort, throw InsufficientInventoryError
 *     coupon? → re-check it and record one use (atomic, conditional)
 *     coupon unusable?    → abort, throw CouponUnavailableError
 *     save the order
 *   COMMIT                 (any error before this → full ROLLBACK)
 *
 * Outcomes:
 *   - success                → order saved, stock decreased exactly once,
 *                              coupon usage +1 (if a coupon was used)
 *   - not enough stock       → InsufficientInventoryError, nothing changed
 *   - coupon can't be used   → CouponUnavailableError, nothing changed
 *   - unpaid limit reached   → UnpaidOrderLimitError, nothing changed
 *   - order insert fails     → error rethrown, nothing changed
 *
 * Production (MongoDB Atlas / any replica set) uses a real MongoDB
 * transaction. A standalone local `mongod` cannot run transactions, so
 * there the same steps run without one and any stock / coupon use already
 * taken is put back before the error is rethrown (logged once as a warning).
 *
 * If the generated order ID clashes with an existing order (duplicate
 * _id), that attempt has already been fully rolled back, so it is simply
 * retried with a new ID (up to 3 attempts).
 */
export async function placeOrder(
  order: NewOrderInput
): Promise<Order> {
  const MAX_ATTEMPTS = 3;

  for (let attempt = 1; ; attempt++) {
    try {
      return await placeOrderOnce(order);
    } catch (error) {
      if (
        isDuplicateKeyError(error) &&
        attempt < MAX_ATTEMPTS
      ) {
        continue;
      }

      throw error;
    }
  }
}

async function placeOrderOnce(
  order: NewOrderInput
): Promise<Order> {
  const items = await buildInventoryRequests(order.lines);

  if (items.length === 0) {
    throw new Error("Cannot place an order with no items.");
  }

  const limitTarget = orderLimitTarget(order);

  /* ---------------- Replica set / Atlas: real transaction ---------------- */

  if (await supportsTransactions()) {
    if (limitTarget) {
      await prepareOrderLimit(limitTarget.lockId);
    }

    const client = await clientPromise;
    const session = client.startSession();

    try {
      let created: Order | undefined;

      // withTransaction() commits if the callback resolves, aborts (rolls
      // back every write) if it throws, and re-runs the callback on
      // transient errors such as a write conflict with a concurrent order.
      await session.withTransaction(async () => {
        created = undefined;

        // First step, so a refused order never touches stock/coupons.
        if (limitTarget) {
          await assertOrderLimitInTransaction(limitTarget, session);
        }

        const unavailable: UnavailableProduct[] = [];

        for (const item of items) {
          const reserved = await atomicDecrementInventory(
            item,
            session
          );

          if (!reserved) {
            unavailable.push(toUnavailable(item));
          }
        }

        if (unavailable.length > 0) {
          throw new InsufficientInventoryError(unavailable);
        }

        if (order.couponCode) {
          await redeemCoupon(
            order.couponCode,
            order.subtotal,
            order.discount ?? 0,
            couponCustomerOf(order),
            session
          );
        }

        created = await createOrder(order, session);
      });

      if (!created) {
        throw new Error("Order was not created.");
      }

      return created;
    } finally {
      await session.endSession();
    }
  }

  /* ------------- Standalone mongod: compensating rollback ------------- */

  warnOnceNoTransactions();

  const taken: InventoryRequest[] = [];
  let redeemedCouponId: string | undefined;

  // Hold the account lock until this order is saved (or failed), so a
  // parallel order from the same account is counted after this one.
  const releaseOrderLock = limitTarget
    ? await acquireOrderLock(limitTarget.lockId)
    : null;

  try {
    await assertAccountStillExists(limitTarget?.userId);

    if (limitTarget?.limitUnpaid) {
      const db = await getDb();
      const openUnpaidOrders = await db
        .collection("orders")
        .countDocuments(openUnpaidOrdersFilter(limitTarget));

      if (openUnpaidOrders >= MAX_OPEN_UNPAID_ORDERS) {
        throw new UnpaidOrderLimitError(MAX_OPEN_UNPAID_ORDERS);
      }
    }

    const unavailable: UnavailableProduct[] = [];

    for (const item of items) {
      const reserved = await atomicDecrementInventory(item);

      if (reserved) {
        taken.push(item);
      } else {
        unavailable.push(toUnavailable(item));
      }
    }

    if (unavailable.length > 0) {
      throw new InsufficientInventoryError(unavailable);
    }

    if (order.couponCode) {
      redeemedCouponId = await redeemCoupon(
        order.couponCode,
        order.subtotal,
        order.discount ?? 0,
        couponCustomerOf(order)
      );
    }

    return await createOrder(order);
  } catch (error) {
    if (redeemedCouponId) {
      await releaseCoupon(redeemedCouponId);
    }
    await restoreInventory(taken);
    throw error;
  } finally {
    await releaseOrderLock?.();
  }
}

/** An order status change that isn't allowed (shown to the admin). */
export class OrderStatusError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OrderStatusError";
  }
}

/** Raw stored statuses that mean the order has left "Processing". */
const NOT_PROCESSING_STATUSES = ["shipped", "delivered", "cancelled", "fulfilled"];

/**
 * Cancels an order that hasn't shipped yet ("Processing").
 *
 * The status change is a single conditional update, so a double click or
 * two people cancelling at once can only succeed once. Only that one
 * successful cancel puts the stock back and gives back the coupon use.
 *
 * Returns null when the order can't be cancelled (missing, or it has
 * already shipped / been cancelled).
 */
export async function cancelProcessingOrder(
  id: string,
  { by, reason = "" }: { by: "customer" | "admin"; reason?: string }
): Promise<{ order: Order; restockedProductIds: string[] } | null> {
  await migrateOrdersFromJson();

  const db = await getDb();
  const collection = db.collection<OrderRecord>("orders");

  const result = await collection.updateOne(
    { _id: id, status: { $nin: NOT_PROCESSING_STATUSES } },
    {
      $set: {
        status: "cancelled",
        cancelledAt: new Date().toISOString(),
        cancelledBy: by,
        cancelReason: String(reason).trim().slice(0, 200),
        stockRestored: true,
      },
    }
  );

  if (result.modifiedCount !== 1) return null;

  const order = await getOrderById(id);
  if (!order) return null;

  let restockedProductIds: string[] = [];
  try {
    restockedProductIds = await restockLines(order.lines);
  } catch (error) {
    console.error(
      `[CANCEL] Order ${id} was cancelled but its stock could not be put back. Correct the stock manually.`,
      error
    );
  }

  if (order.couponCode) {
    await releaseCouponByCode(order.couponCode);
  }

  return { order, restockedProductIds };
}

/** Gives back one use of a coupon, found by its code. */
async function releaseCouponByCode(code: string): Promise<void> {
  try {
    const normalizedCode = normalizeCouponCode(code);
    const db = await getDb();
    const collection = db.collection<CouponDocument>("coupons");
    const document =
      (await collection.findOne({ _id: normalizedCode })) ??
      (await collection.findOne({ code: normalizedCode }));

    if (document) {
      await releaseCoupon(document._id);
    }
  } catch (error) {
    console.error(`[COUPON] Could not give back one use of coupon ${code}.`, error);
  }
}

export type OrderShipmentInput = {
  courier: string;
  trackingNumber: string;
  trackingUrl: string;
};

const ORDER_STATUS_NAMES: Record<OrderStatus, string> = {
  pending: "Processing",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

/**
 * Cancels an order that was shipped but came back to us (RTO). Like a
 * cancel before shipping: the stock goes back and the coupon use is given
 * back - exactly once (conditional update on "shipped").
 */
export async function cancelReturnedOrder(
  id: string
): Promise<{ order: Order; restockedProductIds: string[] } | null> {
  await migrateOrdersFromJson();

  const db = await getDb();
  const collection = db.collection<OrderRecord>("orders");

  const result = await collection.updateOne(
    { _id: id, status: "shipped", stockRestored: { $ne: true } },
    {
      $set: {
        status: "cancelled",
        cancelledAt: new Date().toISOString(),
        cancelledBy: "admin",
        cancelReason: "Returned to us undelivered (RTO)",
        returnedToSender: true,
        stockRestored: true,
      },
    }
  );

  if (result.modifiedCount !== 1) return null;

  const order = await getOrderById(id);
  if (!order) return null;

  let restockedProductIds: string[] = [];
  try {
    restockedProductIds = await restockLines(order.lines);
  } catch (error) {
    console.error(
      `[RTO] Order ${id} was cancelled (returned to us) but its stock could not be put back. Correct the stock manually.`,
      error
    );
  }

  if (order.couponCode) {
    await releaseCouponByCode(order.couponCode);
  }

  return { order, restockedProductIds };
}

/**
 * Changes an order's status - only along ORDER_STATUS_STEPS:
 *   Processing → Shipped (+ courier details) | Cancelled
 *   Shipped    → Delivered | Cancelled (returned to us / RTO)
 * Delivered and Cancelled are final. Shipped / Delivered orders can still
 * have their courier details edited (same status + shipment).
 *
 * Cancelling goes through cancelProcessingOrder() / cancelReturnedOrder()
 * (stock + coupon use given back once); the API route calls those itself
 * so it can send back-in-stock emails. Every change is a conditional
 * update on the current status, so two admins clicking at once can't
 * apply a step twice.
 */
export async function updateOrderStatus(
  id: string,
  status: OrderStatus,
  shipment?: OrderShipmentInput
): Promise<Order[]> {
  await migrateOrdersFromJson();

  const db = await getDb();
  const collection = db.collection<OrderDocument>("orders");
  const existing = await collection.findOne({ _id: id });

  if (!existing) {
    return getOrders();
  }

  const current = normalizeOrderStatus(existing.status);
  const now = new Date().toISOString();

  // Same status: only editing courier details of a shipped / delivered order.
  if (status === current) {
    if (shipment && (current === "shipped" || current === "delivered")) {
      const previous = normalizeShipment(existing.shipment);
      await collection.updateOne(
        { _id: id, status: existing.status },
        {
          $set: {
            shipment: {
              courier: shipment.courier.trim(),
              trackingNumber: shipment.trackingNumber.trim(),
              trackingUrl: shipment.trackingUrl.trim(),
              shippedAt: previous?.shippedAt || now,
            } satisfies OrderShipment,
          },
        }
      );
    }
    return getOrders();
  }

  if (!canChangeOrderStatus(current, status)) {
    throw new OrderStatusError(
      current === "delivered" || current === "cancelled"
        ? `This order is ${ORDER_STATUS_NAMES[current].toLowerCase()}, which is final. ${
            current === "delivered" ? "Returns and exchanges are handled in Admin → Returns." : ""
          }`.trim()
        : `A ${ORDER_STATUS_NAMES[current].toLowerCase()} order can't be moved to ${ORDER_STATUS_NAMES[status].toLowerCase()}.`
    );
  }

  if (status === "cancelled") {
    const cancelled =
      current === "pending"
        ? await cancelProcessingOrder(id, { by: "admin" })
        : await cancelReturnedOrder(id);
    if (!cancelled) {
      throw new OrderStatusError("This order was just changed. Refresh the page and try again.");
    }
    return getOrders();
  }

  const $set: Record<string, unknown> = { status };

  if (status === "shipped") {
    const previous = normalizeShipment(existing.shipment);
    $set.shipment = {
      courier: shipment?.courier.trim() ?? previous?.courier ?? "",
      trackingNumber: shipment?.trackingNumber.trim() ?? previous?.trackingNumber ?? "",
      trackingUrl: shipment?.trackingUrl.trim() ?? previous?.trackingUrl ?? "",
      shippedAt: previous?.shippedAt || now,
    } satisfies OrderShipment;
  }

  if (status === "delivered" && !existing.deliveredAt) {
    $set.deliveredAt = now;
  }

  const result = await collection.updateOne(
    { _id: id, status: existing.status },
    { $set }
  );

  if (result.modifiedCount !== 1) {
    throw new OrderStatusError("This order was just changed. Refresh the page and try again.");
  }

  return getOrders();
}
