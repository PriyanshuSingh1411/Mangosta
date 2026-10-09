import "server-only";

import type { ClientSession } from "mongodb";
import { COUPONS_PATH, getDb, isMigrated, markMigrated, omitMongoId, readJson } from "./core";
import type { NewOrderInput } from "./orders";
import { calculateCheckoutRewardDiscount, getCheckoutSettings } from "./checkout";
import type { CheckoutReward } from "./checkout";

// Coupons: admin coupons, their rules (per customer, first order, limits)
// and using / releasing them for orders.

export type CouponDocument = Coupon & {
  _id: string;
};

export async function validateCheckoutReward(
  code: string,
  subtotal: number
): Promise<{ reward: CheckoutReward; discount: number }> {
  const normalizedCode = String(code || "").trim().toUpperCase().replace(/\s+/g, "");
  const settings = await getCheckoutSettings();
  const reward = settings.progressRewards.find((item) => item.enabled && item.couponCode === normalizedCode);
  if (!reward) throw new CouponError("Invalid checkout reward code.");

  const discount = calculateCheckoutRewardDiscount(subtotal, reward);
  if (discount <= 0) {
    throw new CouponError(`This reward unlocks at ${reward.threshold}.`);
  }
  return { reward, discount };
}

// ============================================================
// COUPONS
// ============================================================

export type CouponDiscountType =
  | "percentage"
  | "fixed";

export interface Coupon {
  id: string;
  code: string;
  enabled: boolean;
  discountType: CouponDiscountType;
  discountValue: number;
  minOrderValue: number;
  maxDiscount: number;
  startsAt: string;
  expiresAt: string;
  usageLimit: number;
  usageCount: number;
  /**
   * Uses allowed per customer account (0 = no per-customer limit).
   * Cancelled orders give their use back.
   */
  perCustomerLimit: number;
  /** Only for an account's first order (cancelled orders don't count). */
  firstOrderOnly: boolean;
}

export const DEFAULT_COUPON: Omit<
  Coupon,
  "id"
> = {
  code: "",
  enabled: true,
  discountType: "percentage",
  discountValue: 10,
  minOrderValue: 0,
  maxDiscount: 0,
  startsAt: "",
  expiresAt: "",
  usageLimit: 0,
  usageCount: 0,
  perCustomerLimit: 1,
  firstOrderOnly: false,
};

/** Coupons saved before the per-customer rules existed: WELCOME codes are first-order codes. */
function isWelcomeCode(code: string): boolean {
  return /^WELCOME/i.test(code.trim());
}

export function normalizeCouponCode(
  value: string
): string {
  return value
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
}

function normalizeCoupon(
  value: Partial<Coupon>,
  index: number
): Coupon {
  const discountType: CouponDiscountType =
    value.discountType === "fixed"
      ? "fixed"
      : "percentage";

  const discountValue =
    typeof value.discountValue === "number" &&
    Number.isFinite(value.discountValue)
      ? Math.max(0, value.discountValue)
      : DEFAULT_COUPON.discountValue;

  return {
    id:
      typeof value.id === "string" &&
      value.id.trim()
        ? value.id.trim()
        : `coupon-${Date.now()}-${index}`,
    code:
      typeof value.code === "string"
        ? normalizeCouponCode(value.code)
        : "",
    enabled:
      typeof value.enabled === "boolean"
        ? value.enabled
        : DEFAULT_COUPON.enabled,
    discountType,
    discountValue,
    minOrderValue:
      typeof value.minOrderValue ===
        "number" &&
      Number.isFinite(value.minOrderValue)
        ? Math.max(0, value.minOrderValue)
        : DEFAULT_COUPON.minOrderValue,
    maxDiscount:
      typeof value.maxDiscount === "number" &&
      Number.isFinite(value.maxDiscount)
        ? Math.max(0, value.maxDiscount)
        : DEFAULT_COUPON.maxDiscount,
    startsAt:
      typeof value.startsAt === "string"
        ? value.startsAt
        : DEFAULT_COUPON.startsAt,
    expiresAt:
      typeof value.expiresAt === "string"
        ? value.expiresAt
        : DEFAULT_COUPON.expiresAt,
    usageLimit:
      typeof value.usageLimit === "number" &&
      Number.isFinite(value.usageLimit)
        ? Math.max(
            0,
            Math.floor(value.usageLimit)
          )
        : DEFAULT_COUPON.usageLimit,
    usageCount:
      typeof value.usageCount === "number" &&
      Number.isFinite(value.usageCount)
        ? Math.max(
            0,
            Math.floor(value.usageCount)
          )
        : DEFAULT_COUPON.usageCount,
    // Missing on coupons saved before these rules existed: same values as
    // migrateCouponCustomerRules() stores (1 per customer; WELCOME codes
    // first order only).
    perCustomerLimit:
      typeof value.perCustomerLimit === "number" &&
      Number.isFinite(value.perCustomerLimit)
        ? Math.max(0, Math.floor(value.perCustomerLimit))
        : DEFAULT_COUPON.perCustomerLimit,
    firstOrderOnly:
      typeof value.firstOrderOnly === "boolean"
        ? value.firstOrderOnly
        : isWelcomeCode(String(value.code ?? "")),
  };
}

/**
 * One-time: coupons saved before the per-customer rules existed get
 * "1 use per customer", and WELCOME… codes also "first order only".
 * The admin can change both in Admin → Coupons afterwards.
 */
async function migrateCouponCustomerRules(): Promise<void> {
  const migrationId = "coupons-customer-rules-v1";
  if (await isMigrated(migrationId)) {
    return;
  }

  const db = await getDb();
  const collection = db.collection<CouponDocument>("coupons");

  await collection.updateMany(
    { perCustomerLimit: { $exists: false }, code: { $regex: /^welcome/i } },
    { $set: { perCustomerLimit: 1, firstOrderOnly: true } }
  );
  await collection.updateMany(
    { perCustomerLimit: { $exists: false } },
    { $set: { perCustomerLimit: 1 } }
  );
  await collection.updateMany(
    { firstOrderOnly: { $exists: false } },
    { $set: { firstOrderOnly: false } }
  );

  await markMigrated(migrationId);
}

async function migrateCouponsFromJson(): Promise<void> {
  const migrationId = "coupons-json-to-mongodb";
  if (await isMigrated(migrationId)) {
    return;
  }

  const db = await getDb();
  const collection = db.collection<CouponDocument>(
    "coupons"
  );

  if ((await collection.countDocuments()) === 0) {
    const legacyCoupons = await readJson<
      Partial<Coupon>[]
    >(COUPONS_PATH, []);

    const normalized = legacyCoupons
      .map((coupon, index) =>
        normalizeCoupon(coupon, index)
      )
      .filter(
        (coupon) => coupon.code.length > 0
      );

    if (normalized.length > 0) {
      await collection.insertMany(
        normalized.map((coupon) => ({
          ...coupon,
          _id: coupon.id,
        }))
      );
    }
  }

  await markMigrated(migrationId);
}

export async function getCoupons(): Promise<Coupon[]> {
  await migrateCouponsFromJson();
  await migrateCouponCustomerRules();

  const db = await getDb();
  const collection = db.collection<CouponDocument>(
    "coupons"
  );

  const documents = await collection
    .find({})
    .sort({ code: 1 })
    .toArray();

  return documents
    .map((document) =>
      normalizeCoupon(
        omitMongoId(document),
        0
      )
    )
    .filter(
      (coupon) => coupon.code.length > 0
    );
}

/**
 * Saves the admin coupon list.
 *
 * usageCount is owned by checkout (redeemCoupon), so saving coupon
 * settings never overwrites it — otherwise uses recorded while the admin
 * page was open would be lost and the coupon could exceed its limit.
 * It is only written for a NEW coupon, or set to 0 for coupons whose id
 * is in `resetUsageIds` (the admin clicked "Reset usage").
 */
export async function saveCoupons(
  coupons: Coupon[],
  resetUsageIds: ReadonlySet<string> = new Set()
): Promise<void> {
  const db = await getDb();
  const collection = db.collection<CouponDocument>(
    "coupons"
  );

  const normalized = coupons
    .map((coupon, index) =>
      normalizeCoupon(coupon, index)
    )
    .filter(
      (coupon) => coupon.code.length > 0
    );

  const incomingIds = new Set(
    normalized.map((coupon) => coupon.id)
  );

  const existing = await collection
    .find({}, { projection: { _id: 1 } })
    .toArray();

  for (const stored of existing) {
    if (
      typeof stored._id === "string" &&
      !incomingIds.has(stored._id)
    ) {
      await collection.deleteOne({
        _id: stored._id,
      });
    }
  }

  for (const coupon of normalized) {
    const { usageCount, ...settings } = coupon;

    await collection.updateOne(
      { _id: coupon.id },
      resetUsageIds.has(coupon.id)
        ? { $set: { ...settings, usageCount: 0 } }
        : {
            $set: settings,
            $setOnInsert: { usageCount },
          },
      { upsert: true }
    );
  }
}

export function calculateCouponDiscount(
  subtotal: number,
  coupon: Coupon
): number {
  const safeSubtotal = Math.max(
    0,
    Number(subtotal) || 0
  );

  if (
    safeSubtotal < coupon.minOrderValue
  ) {
    return 0;
  }

  let discount =
    coupon.discountType === "percentage"
      ? (safeSubtotal *
          coupon.discountValue) /
        100
      : coupon.discountValue;

  if (
    coupon.discountType ===
      "percentage" &&
    coupon.maxDiscount > 0
  ) {
    discount = Math.min(
      discount,
      coupon.maxDiscount
    );
  }

  return Math.min(
    safeSubtotal,
    Math.max(0, discount)
  );
}

export interface CouponValidationResult {
  coupon: Coupon;
  discount: number;
}

/** The signed-in customer using a coupon (per-customer rules). */
export interface CouponCustomer {
  userId?: string;
  email: string;
}

/** What the per-customer rules need to know about the customer. */
export interface CouponCustomerHistory {
  /** Orders placed before (cancelled orders don't count). */
  previousOrders: number;
  /** Uses of each coupon code (uppercase) on those orders. */
  usesByCode: Map<string, number>;
}

export function couponCustomerOf(order: NewOrderInput): CouponCustomer {
  return {
    userId: order.userId ? String(order.userId) : undefined,
    email: String(order.customer?.email ?? "").trim().toLowerCase(),
  };
}

/**
 * The customer's non-cancelled orders and the coupons used on them.
 * Matched by account id AND by email, so orders placed with the same
 * email before accounts were linked to orders count too.
 * Pass the order transaction's session to read inside it.
 */
async function loadCouponCustomerHistory(
  customer: CouponCustomer,
  session?: ClientSession
): Promise<CouponCustomerHistory> {
  const owner: Record<string, string>[] = [];
  if (customer.userId) owner.push({ userId: customer.userId });
  if (customer.email) owner.push({ "customer.email": customer.email });

  const history: CouponCustomerHistory = {
    previousOrders: 0,
    usesByCode: new Map(),
  };

  if (owner.length === 0) return history;

  const db = await getDb();
  const orders = await db
    .collection("orders")
    .find(
      { $or: owner, status: { $ne: "cancelled" } },
      { projection: { _id: 0, couponCode: 1 }, session }
    )
    .toArray();

  history.previousOrders = orders.length;

  for (const order of orders) {
    const code =
      typeof order.couponCode === "string"
        ? normalizeCouponCode(order.couponCode)
        : "";
    if (code) {
      history.usesByCode.set(code, (history.usesByCode.get(code) ?? 0) + 1);
    }
  }

  return history;
}

/** For the checkout coupon list: the signed-in customer's history. */
export function getCouponCustomerHistory(
  customer: CouponCustomer
): Promise<CouponCustomerHistory> {
  return loadCouponCustomerHistory(customer);
}

/**
 * The per-customer rules. Returns the message to show when this customer
 * can't use the coupon, or null when they can.
 */
export function couponCustomerProblem(
  coupon: Pick<Coupon, "code" | "perCustomerLimit" | "firstOrderOnly">,
  history: CouponCustomerHistory | null
): string | null {
  const hasRules = coupon.firstOrderOnly || coupon.perCustomerLimit > 0;

  if (!hasRules) return null;

  if (!history) {
    return "Please sign in to use this coupon.";
  }

  if (coupon.firstOrderOnly && history.previousOrders > 0) {
    return "This coupon is only for your first order.";
  }

  const used = history.usesByCode.get(normalizeCouponCode(coupon.code)) ?? 0;

  if (coupon.perCustomerLimit > 0 && used >= coupon.perCustomerLimit) {
    return coupon.perCustomerLimit === 1
      ? "You've already used this coupon."
      : `You've already used this coupon ${used} times, the most allowed per customer.`;
  }

  return null;
}

/**
 * A coupon or reward rule the customer didn't meet. Its message is meant
 * for the customer; any other error (e.g. the database) is not shown.
 */
export class CouponError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CouponError";
  }
}

/**
 * Checkout preview / pricing. `customer` is the signed-in customer (null
 * when signed out): coupons with per-customer rules need one.
 */
export async function validateCoupon(
  code: string,
  subtotal: number,
  customer: CouponCustomer | null,
  now = new Date()
): Promise<CouponValidationResult> {
  const normalizedCode =
    normalizeCouponCode(code);
  const coupons = await getCoupons();
  const coupon = coupons.find(
    (item) => item.code === normalizedCode
  );

  if (!coupon) {
    throw new CouponError(
      "Invalid coupon code."
    );
  }

  const history =
    customer && (coupon.firstOrderOnly || coupon.perCustomerLimit > 0)
      ? await loadCouponCustomerHistory(customer)
      : null;

  const discount = assertCouponApplies(
    coupon,
    subtotal,
    now,
    history,
    Boolean(customer)
  );

  return {
    coupon,
    discount,
  };
}

/**
 * Every coupon rule in one place. Returns the discount for this subtotal,
 * or throws a CouponError whose message is shown to the customer.
 * Used by validateCoupon() (checkout preview / pricing) and by
 * redeemCoupon() (inside the order transaction), so both apply the
 * exact same rules. `history` is the customer's order history (null when
 * there is no signed-in customer, or the coupon has no per-customer rules).
 */
function assertCouponApplies(
  coupon: Coupon,
  subtotal: number,
  now: Date,
  history: CouponCustomerHistory | null,
  hasCustomer: boolean
): number {
  if (!coupon.enabled) {
    throw new CouponError(
      "This coupon is currently disabled."
    );
  }

  if (coupon.startsAt) {
    const startsAt = new Date(
      coupon.startsAt
    );

    if (
      !Number.isNaN(
        startsAt.getTime()
      ) &&
      now < startsAt
    ) {
      throw new CouponError(
        "This coupon is not active yet."
      );
    }
  }

  if (coupon.expiresAt) {
    const expiresAt = new Date(
      coupon.expiresAt
    );

    if (
      !Number.isNaN(
        expiresAt.getTime()
      ) &&
      now > expiresAt
    ) {
      throw new CouponError(
        "This coupon has expired."
      );
    }
  }

  if (
    coupon.usageLimit > 0 &&
    coupon.usageCount >=
      coupon.usageLimit
  ) {
    throw new CouponError(
      "This coupon has reached its usage limit."
    );
  }

  const customerProblem = couponCustomerProblem(
    coupon,
    hasCustomer ? history ?? { previousOrders: 0, usesByCode: new Map() } : null
  );

  if (customerProblem) {
    throw new CouponError(customerProblem);
  }

  const safeSubtotal = Math.max(
    0,
    Number(subtotal) || 0
  );

  if (
    safeSubtotal <
    coupon.minOrderValue
  ) {
    throw new CouponError(
      `This coupon requires a minimum order of ${coupon.minOrderValue}.`
    );
  }

  const discount =
    calculateCouponDiscount(
      safeSubtotal,
      coupon
    );

  if (discount <= 0) {
    throw new CouponError(
      "This coupon does not apply to this order."
    );
  }

  return discount;
}

/**
 * Thrown by placeOrder() when the order's coupon can no longer be used
 * (limit reached by a simultaneous order, disabled, expired, or changed
 * since the order was priced). When this is thrown, NO order exists, no
 * stock was taken and the coupon's usage is unchanged.
 * The checkout API maps it to HTTP 409 Conflict.
 */
export class CouponUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CouponUnavailableError";
  }
}

/**
 * Records one use of a coupon — the ONLY place coupon usage increases.
 * Called by placeOrder() inside the order transaction.
 *
 * 1. Re-reads the coupon and re-applies every rule (enabled, dates,
 *    usage limit, per-customer rules, minimum order) as of now. The
 *    customer's orders are read inside the same transaction, after the
 *    account lock taken by placeOrder(), so two orders of one customer
 *    can't both use their last allowed use.
 * 2. Checks the discount still equals the one the order was priced with.
 * 3. Atomically increments usage with a conditional update:
 *      WHERE _id = coupon AND usageCount < usageLimit   (if limited)
 *      SET   usageCount = usageCount + 1
 *
 * Returns the coupon document _id (for releaseCoupon on the fallback path).
 */
export async function redeemCoupon(
  code: string,
  subtotal: number,
  expectedDiscount: number,
  customer: CouponCustomer,
  session?: ClientSession
): Promise<string> {
  const normalizedCode =
    normalizeCouponCode(code);

  const checkoutSettings = await getCheckoutSettings();
  const reward = checkoutSettings.progressRewards.find(
    (item) => item.enabled && item.couponCode === normalizedCode
  );

  if (reward) {
    const discount = calculateCheckoutRewardDiscount(subtotal, reward);
    if (discount <= 0) {
      throw new CouponUnavailableError(`This reward unlocks at ${reward.threshold}.`);
    }
    if (Math.abs(discount - expectedDiscount) > 0.005) {
      throw new CouponUnavailableError(
        "This reward changed while you were checking out. Please review your order and try again."
      );
    }
    return "";
  }

  const db = await getDb();
  const collection =
    db.collection<CouponDocument>("coupons");

  // Coupons saved by the admin use the coupon id as _id; very old data
  // may use the code as _id — try that first, then look up by code.
  const document =
    (await collection.findOne(
      { _id: normalizedCode },
      { session }
    )) ??
    (await collection.findOne(
      { code: normalizedCode },
      { session }
    ));

  if (!document) {
    throw new CouponUnavailableError(
      "This coupon is no longer available."
    );
  }

  const coupon = normalizeCoupon(
    omitMongoId(document),
    0
  );

  const history =
    coupon.firstOrderOnly || coupon.perCustomerLimit > 0
      ? await loadCouponCustomerHistory(customer, session)
      : null;

  let discount: number;

  try {
    discount = assertCouponApplies(
      coupon,
      subtotal,
      new Date(),
      history,
      Boolean(customer.userId || customer.email)
    );
  } catch (error) {
    throw new CouponUnavailableError(
      error instanceof CouponError
        ? error.message
        : "This coupon can no longer be used."
    );
  }

  if (Math.abs(discount - expectedDiscount) > 0.005) {
    throw new CouponUnavailableError(
      "This coupon was changed while you were checking out. Please review your order and try again."
    );
  }

  const result = await collection.updateOne(
    coupon.usageLimit > 0
      ? {
          _id: document._id,
          usageCount: { $lt: coupon.usageLimit },
        }
      : { _id: document._id },
    { $inc: { usageCount: 1 } },
    { session }
  );

  if (result.modifiedCount !== 1) {
    throw new CouponUnavailableError(
      "This coupon has reached its usage limit."
    );
  }

  return document._id;
}

/**
 * Gives back one coupon use. Only used by placeOrder()'s fallback path for
 * MongoDB servers without transaction support.
 */
export async function releaseCoupon(
  couponDocumentId: string
): Promise<void> {
  try {
    const db = await getDb();
    await db
      .collection<CouponDocument>("coupons")
      .updateOne(
        { _id: couponDocumentId, usageCount: { $gt: 0 } },
        { $inc: { usageCount: -1 } }
      );
  } catch (error) {
    console.error(
      `[COUPON] Could not release one use of coupon ${couponDocumentId}. Correct its usage count manually.`,
      error
    );
  }
}
