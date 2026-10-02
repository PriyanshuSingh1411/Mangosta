import { randomBytes } from "crypto";
import { readFile } from "fs/promises";
import path from "path";
import clientPromise from "@/app/lib/mongodb";
import type { ClientSession } from "mongodb";
import type { Product } from "@/app/data/productTypes";

export { slugify } from "@/app/data/productTypes";

// Server-only. Runtime-managed data is stored in MongoDB so this works on Vercel.
// Local JSON files are read only for one-time migration / fallback purposes.
const DATA_DIR = path.join(process.cwd(), "data");
const PRODUCTS_PATH = path.join(DATA_DIR, "products.json");
const ORDERS_PATH = path.join(DATA_DIR, "orders.json");
const COUPONS_PATH = path.join(DATA_DIR, "coupons.json");
const SETTINGS_PATH = path.join(DATA_DIR, "settings.json");
const CHECKOUT_SETTINGS_PATH = path.join(DATA_DIR, "checkout.json");

const DB_NAME = "mangosta";

// -----------------------------------------------------------------------------
// MongoDB document types
// -----------------------------------------------------------------------------

type MigrationDocument = {
  _id: string;
  completedAt: Date;
};

type OrderDocument = Order & {
  _id: string;
};

type CheckoutSettingsDocument = CheckoutSettings & {
  _id: "default";
};

type CouponDocument = Coupon & {
  _id: string;
};

type SiteSettingsDocument = SiteSettings & {
  _id: "default";
};

// -----------------------------------------------------------------------------
// Shared helpers
// -----------------------------------------------------------------------------

async function getDb() {
  const client = await clientPromise;
  return client.db(DB_NAME);
}

async function readJson<T>(
  filePath: string,
  fallback: T
): Promise<T> {
  try {
    const raw = await readFile(filePath, "utf-8");
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

async function isMigrated(
  migrationId: string
): Promise<boolean> {
  const db = await getDb();
  const collection = db.collection<any>("migrations");
  const result = await collection.findOne({
    _id: migrationId,
  });
  return Boolean(result);
}

async function markMigrated(
  migrationId: string
): Promise<void> {
  const db = await getDb();
  const collection = db.collection<any>("migrations");

  await collection.updateOne(
    { _id: migrationId },
    { $set: { completedAt: new Date() } },
    { upsert: true }
  );
}

function omitMongoId<T extends { _id?: unknown }>(
  document: T
): Omit<T, "_id"> {
  const { _id: _ignored, ...rest } = document;
  return rest as Omit<T, "_id">;
}

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

export interface Order {
  id: string;
  createdAt: string;

  status:
    | "pending"
    | "fulfilled"
    | "cancelled";

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
}

// ============================================================
// HERO
// ============================================================

export type HeroFontStyle =
  | "display"
  | "body"
  | "technical"
  | "mono";

export type HeroTransition = "fade" | "slide";

/**
 * Focal point for the hero image. Maps directly to the CSS
 * object-position, so the subject stays in frame when the image is
 * cropped for different screen shapes (tall phones vs. wide desktops).
 */
export type HeroImagePosition =
  | "center"
  | "top"
  | "bottom"
  | "left"
  | "right"
  | "left top"
  | "right top"
  | "left bottom"
  | "right bottom";

export const HERO_IMAGE_POSITIONS: HeroImagePosition[] = [
  "center",
  "top",
  "bottom",
  "left",
  "right",
  "left top",
  "right top",
  "left bottom",
  "right bottom",
];

export function normalizeHeroImagePosition(
  value: unknown
): HeroImagePosition {
  return HERO_IMAGE_POSITIONS.includes(
    value as HeroImagePosition
  )
    ? (value as HeroImagePosition)
    : "center";
}

export interface HeroSlide {
  id: string;
  enabled: boolean;
  order: number;
  image: string;
  /** Optional portrait image shown on phones / narrow screens. */
  mobileImage?: string;
  /** Focal point used when the image is cropped. */
  imagePosition?: HeroImagePosition;
  topLabel: string;
  secondaryLabel: string;
  headlineLine1: string;
  headlineLine2: string;
  headlineLine3: string;
  description: string;
  buttonText: string;
  buttonUrl: string;
  issueLabel: string;
  issueSubtitle: string;
  productId: string;
  titleStyle: HeroFontStyle;
}

export interface HeroSettings {
  enabled: boolean;
  autoplay: boolean;
  autoplayDuration: number;
  transitionDuration: number;
  transition: HeroTransition;
  slides: HeroSlide[];
}

interface LegacyHeroSettings {
  heroImage?: string;
  topLabel?: string;
  secondaryLabel?: string;
  headlineLine1?: string;
  headlineLine2?: string;
  headlineLine3?: string;
  description?: string;
  buttonText?: string;
  buttonUrl?: string;
  issueLabel?: string;
  issueSubtitle?: string;
}

// ============================================================
// MANGOSTA CODE / DROP / STUDIOS
// ============================================================

export type MangostaCodeStyle =
  | "display"
  | "body"
  | "technical"
  | "mono";

export interface MangostaCodeBox {
  enabled: boolean;
  heading: string;
  description: string;
  headingStyle: MangostaCodeStyle;
  descriptionStyle: MangostaCodeStyle;
  productId: string;
}

export interface DropProduct {
  enabled: boolean;
  productId: string;
  title: string;
  link: string;
  titleStyle: MangostaCodeStyle;
  order: number;
}

export interface DropSettings {
  enabled: boolean;
  label: string;
  title: string;
  products: DropProduct[];
}

export interface MangostaStudio {
  enabled: boolean;
  productId: string;
  title: string;
  image: string;
  tag: string;
  titleStyle: MangostaCodeStyle;
  link: string;
  order: number;
}

// ============================================================
// SITE SETTINGS
// ============================================================

export interface SiteSettings {
  hero: HeroSettings;
  heroHeadline: string;
  heroSubline: string;
  announcementBar: string;
  announcementEnabled: boolean;
  collectionEnabled: boolean;
  collectionLabel: string;
  collectionTitle: string;
  collectionSubtitle: string;
  collectionDescription: string;
  collectionImage: string;
  collectionOverlayEnabled: boolean;
  collectionOverlayOpacity: number;
  mangostaCode: MangostaCodeBox[];
  drop: DropSettings;
  mangostaStudiosEnabled: boolean;
  mangostaStudiosLabel: string;
  mangostaStudios: MangostaStudio[];
  newsletterEnabled: boolean;
  newsletterSubject: string;
  newsletterHeading: string;
  newsletterBody: string;
  newsletterButtonText: string;
  newsletterButtonUrl: string;
  newsletterFooterText: string;
  newsletterNotificationEmail: string;
  newsletterNotificationEnabled: boolean;
}

// ============================================================
// PRODUCTS
// ============================================================

async function getProductsCollection() {
  const db = await getDb();
  return db.collection<Product>("products");
}

async function migrateProductsFromJson(): Promise<void> {
  const migrationId = "products-json-to-mongodb";
  if (await isMigrated(migrationId)) {
    return;
  }

  const collection = await getProductsCollection();

  // Do not duplicate products if the collection already has data.
  if ((await collection.countDocuments()) === 0) {
    const products = await readJson<Product[]>(
      PRODUCTS_PATH,
      []
    );

    if (products.length > 0) {
      await collection.insertMany(products);
    }
  }

  await markMigrated(migrationId);
}

export async function getProducts(): Promise<Product[]> {
  await migrateProductsFromJson();

  const collection = await getProductsCollection();
  return collection
    .find({}, { projection: { _id: 0 } })
    .sort({ id: 1 })
    .toArray();
}

export async function getProduct(
  id: string
): Promise<Product | undefined> {
  const collection = await getProductsCollection();

  const product = await collection.findOne(
    { id },
    { projection: { _id: 0 } }
  );

  return product ?? undefined;
}

export async function upsertProduct(
  product: Product
): Promise<Product[]> {
  const collection = await getProductsCollection();

  await collection.replaceOne(
    { id: product.id },
    product,
    { upsert: true }
  );

  return collection
    .find({}, { projection: { _id: 0 } })
    .sort({ id: 1 })
    .toArray();
}

/** Product fields the admin edit form can change (not id/currency/inventory). */
export type ProductEditableFields = Omit<
  Product,
  "id" | "currency" | "inventory"
>;

export type UpdateProductResult =
  | { status: "updated"; product: Product }
  | { status: "not_found" }
  | { status: "stock_changed"; currentInventory: number };

/**
 * Updates an existing product in place (used by the admin edit form).
 *
 * Stock is never overwritten by accident:
 * - `stock` omitted → inventory is not written at all, so sales made while
 *   the admin had the form open are kept.
 * - `stock` given → the admin typed a new stock value. It is written only
 *   if the product's inventory is still `stock.expected` (the value the
 *   form loaded). If orders changed it meanwhile, nothing is saved and
 *   "stock_changed" is returned with the current value.
 *
 * Fields set to undefined are removed ($unset) rather than stored as null.
 */
export async function updateProduct(
  id: string,
  fields: ProductEditableFields,
  stock?: { expected: number; next: number }
): Promise<UpdateProductResult> {
  const collection = await getProductsCollection();

  const $set: Record<string, unknown> = {};
  const $unset: Record<string, ""> = {};

  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined) {
      $unset[key] = "";
    } else {
      $set[key] = value;
    }
  }

  if (stock) {
    $set.inventory = stock.next;
  }

  const result = await collection.updateOne(
    stock
      ? { id, inventory: stock.expected }
      : { id },
    Object.keys($unset).length > 0
      ? { $set, $unset }
      : { $set }
  );

  const current = await getProduct(id);

  if (!current) {
    return { status: "not_found" };
  }

  if (result.matchedCount === 0) {
    return {
      status: "stock_changed",
      currentInventory: current.inventory,
    };
  }

  return { status: "updated", product: current };
}

// ============================================================
// INVENTORY
//
// Single stock-decrease path for the whole app:
//
//   placeOrder()  →  atomicDecrementInventory()   (per product)
//
// The two helpers below are deliberately NOT exported, so nothing
// else can decrease stock. createOrder() never reads or writes
// inventory. The admin product APIs only *set* an absolute stock
// value (a stock-take), they never decrement it — and on edit only
// via compare-and-set in updateProduct(), so sales are never lost.
// ============================================================

type InventoryRequest = {
  productId: string;
  productName: string;
  quantity: number;
};

export type UnavailableProduct = {
  productId: string;
  productName: string;
};

/**
 * Thrown by placeOrder() when one or more products do not have enough
 * stock. When this is thrown, NO order exists and inventory is unchanged.
 * The checkout API maps it to HTTP 409 Conflict.
 */
export class InsufficientInventoryError extends Error {
  readonly products: UnavailableProduct[];

  constructor(products: UnavailableProduct[]) {
    const names = products
      .map((product) => product.productName)
      .join(", ");

    super(
      `Some products are no longer available in the requested quantity: ${names}.`
    );

    this.name = "InsufficientInventoryError";
    this.products = products;
  }
}

/**
 * Atomically decrements one product's inventory:
 *
 *   UPDATE products
 *   SET    inventory = inventory - quantity
 *   WHERE  id = productId AND inventory >= quantity
 *
 * Returns true when the document was updated (stock reserved).
 * Returns false when the product is missing or has too little stock
 * (nothing is changed in that case).
 */
async function atomicDecrementInventory(
  productId: string,
  quantity: number,
  session?: ClientSession
): Promise<boolean> {
  const collection = await getProductsCollection();

  const result = await collection.updateOne(
    {
      id: productId,
      inventory: { $gte: quantity },
    },
    {
      $inc: { inventory: -quantity },
    },
    { session }
  );

  return result.modifiedCount === 1;
}

/**
 * Puts stock back. Only used by placeOrder()'s fallback path for
 * MongoDB servers without transaction support (see placeOrder).
 */
async function restoreInventory(
  items: InventoryRequest[]
): Promise<void> {
  const collection = await getProductsCollection();

  for (const item of items) {
    try {
      await collection.updateOne(
        { id: item.productId },
        { $inc: { inventory: item.quantity } }
      );
    } catch (error) {
      console.error(
        `[INVENTORY] Could not restore ${item.quantity} unit(s) of product ${item.productId}. Correct this product's stock manually.`,
        error
      );
    }
  }
}

/**
 * Combines cart lines into one stock request per product.
 * (Two lines can be the same product in different sizes/colours,
 * and stock is tracked per product.)
 */
function groupLinesByProduct(
  lines: OrderLine[]
): InventoryRequest[] {
  const grouped = new Map<string, InventoryRequest>();

  for (const line of lines) {
    if (
      !Number.isInteger(line.quantity) ||
      line.quantity < 1
    ) {
      throw new Error(
        `Invalid quantity for ${line.productName}.`
      );
    }

    const existing = grouped.get(line.productId);

    if (existing) {
      existing.quantity += line.quantity;
    } else {
      grouped.set(line.productId, {
        productId: line.productId,
        productName: line.productName,
        quantity: line.quantity,
      });
    }
  }

  return [...grouped.values()];
}

let transactionSupport: Promise<boolean> | null = null;
let warnedNoTransactions = false;

/**
 * Multi-document transactions need a replica set or sharded cluster.
 * MongoDB Atlas (any tier) is always a replica set. A plain local
 * `mongod` is standalone and cannot run transactions.
 */
function supportsTransactions(): Promise<boolean> {
  if (!transactionSupport) {
    transactionSupport = (async () => {
      const db = await getDb();
      const hello = await db.command({ hello: 1 });

      return (
        Boolean(hello.setName) ||
        hello.msg === "isdbgrid"
      );
    })().catch((error) => {
      // Detect again on the next order instead of caching a failure.
      transactionSupport = null;
      throw error;
    });
  }

  return transactionSupport;
}

export async function deleteProduct(
  id: string
): Promise<Product[]> {
  const collection = await getProductsCollection();

  await collection.deleteOne({ id });

  return collection
    .find({}, { projection: { _id: 0 } })
    .sort({ id: 1 })
    .toArray();
}

export function generateProductId(
  existing: Product[]
): string {
  const nums = existing
    .map((product) =>
      parseInt(
        product.id.replace(/^p-/, ""),
        10
      )
    )
    .filter((number) => !Number.isNaN(number));

  const max =
    nums.length > 0
      ? Math.max(...nums)
      : 0;

  return `p-${String(max + 1).padStart(3, "0")}`;
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
  const collection = db.collection<any>("orders");

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

export async function getOrders(): Promise<Order[]> {
  await migrateOrdersFromJson();

  const db = await getDb();
  const collection = db.collection<any>("orders");

  const documents = await collection
    .find({})
    .sort({ createdAt: -1 })
    .toArray();

  return documents.map((document) => {
    const order = omitMongoId(document) as Partial<Order>;

    return {
      ...order,

      id: String(order.id ?? ""),
      createdAt: String(
        order.createdAt ?? new Date().toISOString()
      ),

      status:
        order.status === "fulfilled" ||
        order.status === "cancelled"
          ? order.status
          : "pending",

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
  });
}

export async function saveOrders(
  orders: Order[]
): Promise<void> {
  const db = await getDb();
  const collection = db.collection<any>("orders");

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

/**
 * Order IDs look like MG-MG4X2K1A-7F3A9C:
 *   MG- + time (base 36) + 6 random hex characters.
 * The time part keeps IDs roughly sortable; the random part means two
 * orders placed in the same millisecond still get different IDs
 * (16.7 million combinations per millisecond). placeOrder() also retries
 * with a fresh ID if a clash ever happens anyway.
 */
function generateOrderId(): string {
  const time = Date.now().toString(36).toUpperCase();
  const random = randomBytes(3).toString("hex").toUpperCase();

  return `MG-${time}-${random}`;
}

function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: unknown }).code === 11000
  );
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
    db.collection<any>("orders");

  await collection.insertOne(
    {
      ...newOrder,
      _id: newOrder.id,
    },
    { session }
  );

  return newOrder;
}

/**
 * Places an order as ONE all-or-nothing operation:
 *
 *   BEGIN TRANSACTION
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
  const items = groupLinesByProduct(order.lines);

  if (items.length === 0) {
    throw new Error("Cannot place an order with no items.");
  }

  /* ---------------- Replica set / Atlas: real transaction ---------------- */

  if (await supportsTransactions()) {
    const client = await clientPromise;
    const session = client.startSession();

    try {
      let created: Order | undefined;

      // withTransaction() commits if the callback resolves, aborts (rolls
      // back every write) if it throws, and re-runs the callback on
      // transient errors such as a write conflict with a concurrent order.
      await session.withTransaction(async () => {
        created = undefined;
        const unavailable: UnavailableProduct[] = [];

        for (const item of items) {
          const reserved = await atomicDecrementInventory(
            item.productId,
            item.quantity,
            session
          );

          if (!reserved) {
            unavailable.push({
              productId: item.productId,
              productName: item.productName,
            });
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

  if (!warnedNoTransactions) {
    warnedNoTransactions = true;
    console.warn(
      "[INVENTORY] This MongoDB server does not support transactions (standalone mongod). Orders use compensating rollback instead. Use MongoDB Atlas or a replica set in production."
    );
  }

  const taken: InventoryRequest[] = [];
  let redeemedCouponId: string | undefined;

  try {
    const unavailable: UnavailableProduct[] = [];

    for (const item of items) {
      const reserved = await atomicDecrementInventory(
        item.productId,
        item.quantity
      );

      if (reserved) {
        taken.push(item);
      } else {
        unavailable.push({
          productId: item.productId,
          productName: item.productName,
        });
      }
    }

    if (unavailable.length > 0) {
      throw new InsufficientInventoryError(unavailable);
    }

    if (order.couponCode) {
      redeemedCouponId = await redeemCoupon(
        order.couponCode,
        order.subtotal,
        order.discount ?? 0
      );
    }

    return await createOrder(order);
  } catch (error) {
    if (redeemedCouponId !== undefined) {
      await releaseCoupon(redeemedCouponId);
    }
    await restoreInventory(taken);
    throw error;
  }
}

export async function updateOrderStatus(
  id: string,
  status: Order["status"]
): Promise<Order[]> {
  await migrateOrdersFromJson();

  const db = await getDb();
  const collection = db.collection<any>("orders");

  await collection.updateOne(
    { _id: id },
    { $set: { status } }
  );

  return getOrders();
}

// ============================================================
// CHECKOUT / SHIPPING SETTINGS
// ============================================================

export interface ShippingRule {
  id: string;
  enabled: boolean;
  minOrderValue: number;
  shippingCost: number;
}

export interface CheckoutSettings {
  enabled: boolean;
  defaultShipping: number;
  freeShippingEnabled: boolean;
  freeShippingThreshold: number;
  rules: ShippingRule[];
}

export const DEFAULT_CHECKOUT_SETTINGS: CheckoutSettings = {
  enabled: true,
  defaultShipping: 12,
  freeShippingEnabled: true,
  freeShippingThreshold: 10,
  rules: [],
};

function normalizeCheckoutSettings(
  saved:
    Partial<CheckoutSettings> | null | undefined
): CheckoutSettings {
  const source = saved ?? {};
  const rawRules = Array.isArray(source.rules)
    ? source.rules
    : [];

  const rules: ShippingRule[] = rawRules
    .map((rule, index) => ({
      id:
        typeof rule.id === "string" &&
        rule.id.trim()
          ? rule.id
          : `shipping-rule-${index + 1}`,
      enabled:
        typeof rule.enabled === "boolean"
          ? rule.enabled
          : true,
      minOrderValue:
        typeof rule.minOrderValue === "number" &&
        Number.isFinite(rule.minOrderValue) &&
        rule.minOrderValue >= 0
          ? rule.minOrderValue
          : 0,
      shippingCost:
        typeof rule.shippingCost === "number" &&
        Number.isFinite(rule.shippingCost) &&
        rule.shippingCost >= 0
          ? rule.shippingCost
          : 0,
    }))
    .sort(
      (a, b) =>
        b.minOrderValue - a.minOrderValue
    );

  return {
    enabled:
      typeof source.enabled === "boolean"
        ? source.enabled
        : DEFAULT_CHECKOUT_SETTINGS.enabled,
    defaultShipping:
      typeof source.defaultShipping === "number" &&
      Number.isFinite(source.defaultShipping) &&
      source.defaultShipping >= 0
        ? source.defaultShipping
        : DEFAULT_CHECKOUT_SETTINGS.defaultShipping,
    freeShippingEnabled:
      typeof source.freeShippingEnabled ===
      "boolean"
        ? source.freeShippingEnabled
        : DEFAULT_CHECKOUT_SETTINGS.freeShippingEnabled,
    freeShippingThreshold:
      typeof source.freeShippingThreshold ===
        "number" &&
      Number.isFinite(
        source.freeShippingThreshold
      ) &&
      source.freeShippingThreshold >= 0
        ? source.freeShippingThreshold
        : DEFAULT_CHECKOUT_SETTINGS.freeShippingThreshold,
    rules,
  };
}

async function migrateCheckoutFromJson(): Promise<void> {
  const migrationId = "checkout-json-to-mongodb";
  if (await isMigrated(migrationId)) {
    return;
  }

  const db = await getDb();
  const collection =
    db.collection<any>(
      "checkoutSettings"
    );

  const existing = await collection.findOne({
    _id: "default",
  });

  if (!existing) {
    const legacy = await readJson<
      Partial<CheckoutSettings>
    >(CHECKOUT_SETTINGS_PATH, {});

    const normalized =
      normalizeCheckoutSettings(legacy);

    await collection.replaceOne(
      { _id: "default" },
      {
        ...normalized,
        _id: "default",
      },
      { upsert: true }
    );
  }

  await markMigrated(migrationId);
}

export async function getCheckoutSettings(): Promise<CheckoutSettings> {
  await migrateCheckoutFromJson();

  const db = await getDb();
  const collection =
    db.collection<any>(
      "checkoutSettings"
    );

  const saved = await collection.findOne({
    _id: "default",
  });

  return normalizeCheckoutSettings(
    saved ? omitMongoId(saved) : null
  );
}

export async function saveCheckoutSettings(
  settings: CheckoutSettings
): Promise<void> {
  const db = await getDb();
  const collection =
    db.collection<any>(
      "checkoutSettings"
    );

  const normalized =
    normalizeCheckoutSettings(settings);

  await collection.replaceOne(
    { _id: "default" },
    {
      ...normalized,
      _id: "default",
    },
    { upsert: true }
  );
}

export function calculateShipping(
  subtotal: number,
  settings: CheckoutSettings
): number {
  const safeSubtotal = Math.max(
    0,
    Number(subtotal) || 0
  );

  if (!settings.enabled) {
    return 0;
  }

  if (
    settings.freeShippingEnabled &&
    safeSubtotal >=
      settings.freeShippingThreshold
  ) {
    return 0;
  }

  const matchingRule = settings.rules
    .filter((rule) => rule.enabled)
    .sort(
      (a, b) =>
        b.minOrderValue - a.minOrderValue
    )
    .find(
      (rule) =>
        safeSubtotal >= rule.minOrderValue
    );

  return matchingRule
    ? Math.max(0, matchingRule.shippingCost)
    : Math.max(0, settings.defaultShipping);
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
};

function normalizeCouponCode(
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
  };
}

async function migrateCouponsFromJson(): Promise<void> {
  const migrationId = "coupons-json-to-mongodb";
  if (await isMigrated(migrationId)) {
    return;
  }

  const db = await getDb();
  const collection = db.collection<any>(
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

  const db = await getDb();
  const collection = db.collection<any>(
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
  const collection = db.collection<any>(
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

export async function validateCoupon(
  code: string,
  subtotal: number,
  now = new Date()
): Promise<CouponValidationResult> {
  const normalizedCode =
    normalizeCouponCode(code);
  const coupons = await getCoupons();
  const coupon = coupons.find(
    (item) => item.code === normalizedCode
  );

  if (!coupon) {
    throw new Error(
      "Invalid coupon code."
    );
  }

  const discount = assertCouponApplies(
    coupon,
    subtotal,
    now
  );

  return {
    coupon,
    discount,
  };
}

/**
 * Every coupon rule in one place. Returns the discount for this subtotal,
 * or throws an Error whose message is shown to the customer.
 * Used by validateCoupon() (checkout preview / pricing) and by
 * redeemCoupon() (inside the order transaction), so both apply the
 * exact same rules.
 */
function assertCouponApplies(
  coupon: Coupon,
  subtotal: number,
  now: Date
): number {
  if (!coupon.enabled) {
    throw new Error(
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
      throw new Error(
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
      throw new Error(
        "This coupon has expired."
      );
    }
  }

  if (
    coupon.usageLimit > 0 &&
    coupon.usageCount >=
      coupon.usageLimit
  ) {
    throw new Error(
      "This coupon has reached its usage limit."
    );
  }

  const safeSubtotal = Math.max(
    0,
    Number(subtotal) || 0
  );

  if (
    safeSubtotal <
    coupon.minOrderValue
  ) {
    throw new Error(
      `This coupon requires a minimum order of ${coupon.minOrderValue}.`
    );
  }

  const discount =
    calculateCouponDiscount(
      safeSubtotal,
      coupon
    );

  if (discount <= 0) {
    throw new Error(
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
 *    usage limit, minimum order) as of now.
 * 2. Checks the discount still equals the one the order was priced with.
 * 3. Atomically increments usage with a conditional update:
 *      WHERE _id = coupon AND usageCount < usageLimit   (if limited)
 *      SET   usageCount = usageCount + 1
 *
 * Returns the coupon document _id (for releaseCoupon on the fallback path).
 */
async function redeemCoupon(
  code: string,
  subtotal: number,
  expectedDiscount: number,
  session?: ClientSession
): Promise<string> {
  const normalizedCode =
    normalizeCouponCode(code);

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

  let discount: number;

  try {
    discount = assertCouponApplies(
      coupon,
      subtotal,
      new Date()
    );
  } catch (error) {
    throw new CouponUnavailableError(
      error instanceof Error
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
async function releaseCoupon(
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

// ============================================================
// DEFAULT SETTINGS
// ============================================================

export const DEFAULT_SETTINGS: SiteSettings = {
  hero: {
    enabled: true,
    autoplay: true,
    autoplayDuration: 6000,
    transitionDuration: 700,
    transition: "fade",
    slides: [
      {
        id: "hero-slide-1",
        enabled: true,
        order: 0,
        image: "",
        topLabel: "MANGOSTA / FW26",
        secondaryLabel: "NEW GENERATION",
        headlineLine1: "WEAR",
        headlineLine2: "YOUR",
        headlineLine3: "ATTITUDE.",
        description:
          "A new generation fashion label built for people who create their own rules.",
        buttonText: "SHOP NOW",
        buttonUrl: "/shop",
        issueLabel: "ISSUE 001",
        issueSubtitle: "URBAN APPAREL",
        productId: "",
        titleStyle: "display",
      },
      {
        id: "hero-slide-2",
        enabled: false,
        order: 1,
        image: "",
        topLabel: "MANGOSTA / FW26",
        secondaryLabel: "NEW GENERATION",
        headlineLine1: "MOVE",
        headlineLine2: "WITH",
        headlineLine3: "PURPOSE.",
        description:
          "Designed for movement, built for the streets and made to become part of your everyday.",
        buttonText: "EXPLORE",
        buttonUrl: "/shop",
        issueLabel: "ISSUE 002",
        issueSubtitle: "MOVEMENT / UTILITY",
        productId: "",
        titleStyle: "display",
      },
      {
        id: "hero-slide-3",
        enabled: false,
        order: 2,
        image: "",
        topLabel: "MANGOSTA / FW26",
        secondaryLabel: "THE COLLECTION",
        headlineLine1: "MAKE",
        headlineLine2: "IT",
        headlineLine3: "YOURS.",
        description:
          "No borrowed formulas. Pieces created for individuality, design and culture.",
        buttonText: "VIEW COLLECTION",
        buttonUrl: "/shop",
        issueLabel: "ISSUE 003",
        issueSubtitle: "IDENTITY / CULTURE",
        productId: "",
        titleStyle: "display",
      },
    ],
  },

  newsletterNotificationEnabled: true,

  heroHeadline: "WEAR YOUR CODE",
  heroSubline: "MANGOSTA / FW26",

  announcementBar: "",
  announcementEnabled: false,

  collectionEnabled: true,
  collectionLabel: "05 — NEW COLLECTION",
  collectionTitle: "MANGOSTA",
  collectionSubtitle: "FW / 26",
  collectionDescription:
    "A collection built around movement, utility, and identity.",
  collectionImage: "",
  collectionOverlayEnabled: true,
  collectionOverlayOpacity: 0.35,

  drop: {
    enabled: true,
    label: "03 — THE DROP",
    title: "THE DROP",
    products: [],
  },

  mangostaStudiosEnabled: true,
  mangostaStudiosLabel:
    "04 — MANGOSTA STUDIOS",
  mangostaStudios: [],

  mangostaCode: [
    {
      enabled: true,
      heading: "MOVE",
      description:
        "Designed for movement. Built for everyday life, from the street to wherever you go next.",
      headingStyle: "display",
      descriptionStyle: "body",
      productId: "",
    },
    {
      enabled: true,
      heading: "CREATE",
      description:
        "No borrowed formulas. Every piece starts with an idea and earns its place in the collection.",
      headingStyle: "display",
      descriptionStyle: "body",
      productId: "",
    },
    {
      enabled: true,
      heading: "DEFINE",
      description:
        "Your clothes should say something before you do. Wear what feels like you.",
      headingStyle: "display",
      descriptionStyle: "body",
      productId: "",
    },
  ],

  newsletterEnabled: true,
  newsletterSubject:
    "Welcome to the MANGOSTA WORLD",
  newsletterHeading:
    "WELCOME TO THE WORLD",
  newsletterBody:
    "Thank you for joining the MANGOSTA WORLD.\n\nYou are now part of a community built around individuality, design and culture.\n\nStay tuned for new drops, stories and everything happening inside MANGOSTA.",
  newsletterButtonText:
    "EXPLORE MANGOSTA",
  newsletterButtonUrl: "/",
  newsletterFooterText:
    "MANGOSTA — WEAR YOUR ATTITUDE.",
  newsletterNotificationEmail:
    "mangostateam@gmail.com",
};

// ============================================================
// SETTINGS HELPERS
// ============================================================

function stringValue(
  value: unknown,
  fallback = ""
): string {
  return typeof value === "string"
    ? value
    : fallback;
}

function booleanValue(
  value: unknown,
  fallback: boolean
): boolean {
  return typeof value === "boolean"
    ? value
    : fallback;
}

function numberValue(
  value: unknown,
  fallback: number
): number {
  return typeof value === "number" &&
    Number.isFinite(value)
    ? value
    : fallback;
}

function isRecord(
  value: unknown
): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function normalizeFontStyle(
  value: unknown,
  fallback: MangostaCodeStyle = "display"
): MangostaCodeStyle {
  return value === "display" ||
    value === "body" ||
    value === "technical" ||
    value === "mono"
    ? value
    : fallback;
}

function normalizeHeroSlide(
  value: unknown,
  index: number
): HeroSlide {
  const item = isRecord(value)
    ? value
    : {};

  return {
    id:
      stringValue(item.id) ||
      `hero-slide-${index + 1}`,
    enabled: booleanValue(
      item.enabled,
      true
    ),
    order: numberValue(
      item.order,
      index
    ),
    image: stringValue(item.image),
    mobileImage: stringValue(
      item.mobileImage
    ),
    imagePosition:
      normalizeHeroImagePosition(
        item.imagePosition
      ),
    topLabel: stringValue(
      item.topLabel,
      "MANGOSTA / FW26"
    ),
    secondaryLabel: stringValue(
      item.secondaryLabel,
      "NEW GENERATION"
    ),
    headlineLine1: stringValue(
      item.headlineLine1,
      "WEAR"
    ),
    headlineLine2: stringValue(
      item.headlineLine2,
      "YOUR"
    ),
    headlineLine3: stringValue(
      item.headlineLine3,
      "ATTITUDE."
    ),
    description: stringValue(
      item.description,
      "A new generation fashion label built for people who create their own rules."
    ),
    buttonText: stringValue(
      item.buttonText,
      "SHOP NOW"
    ),
    buttonUrl: stringValue(
      item.buttonUrl,
      "/shop"
    ),
    issueLabel: stringValue(
      item.issueLabel,
      `ISSUE ${String(index + 1).padStart(3, "0")}`
    ),
    issueSubtitle: stringValue(
      item.issueSubtitle,
      "URBAN APPAREL"
    ),
    productId: stringValue(
      item.productId
    ),
    titleStyle: normalizeFontStyle(
      item.titleStyle
    ),
  };
}

function normalizeHeroSettings(
  saved: unknown
): HeroSettings {
  const source = isRecord(saved)
    ? saved
    : {};

  const slides = Array.isArray(
    source.slides
  )
    ? source.slides
        .slice(0, 10)
        .map((slide, index) =>
          normalizeHeroSlide(
            slide,
            index
          )
        )
        .sort(
          (a, b) => a.order - b.order
        )
        .map((slide, index) => ({
          ...slide,
          order: index,
        }))
    : [];

  const legacy = isRecord(saved)
    ? (saved as Partial<LegacyHeroSettings>)
    : {};

  let finalSlides = slides;

  if (finalSlides.length === 0) {
    const hasLegacyHero =
      typeof legacy.heroImage === "string" ||
      typeof legacy.headlineLine1 === "string";

    if (hasLegacyHero) {
      finalSlides = [
        normalizeHeroSlide(
          {
            id: "hero-slide-1",
            enabled:
              typeof source.enabled ===
              "boolean"
                ? source.enabled
                : true,
            order: 0,
            image: legacy.heroImage ?? "",
            topLabel:
              legacy.topLabel ??
              "MANGOSTA / FW26",
            secondaryLabel:
              legacy.secondaryLabel ??
              "NEW GENERATION",
            headlineLine1:
              legacy.headlineLine1 ??
              "WEAR",
            headlineLine2:
              legacy.headlineLine2 ??
              "YOUR",
            headlineLine3:
              legacy.headlineLine3 ??
              "ATTITUDE.",
            description:
              legacy.description ??
              "A new generation fashion label built for people who create their own rules.",
            buttonText:
              legacy.buttonText ??
              "SHOP NOW",
            buttonUrl:
              legacy.buttonUrl ??
              "/shop",
            issueLabel:
              legacy.issueLabel ??
              "ISSUE 001",
            issueSubtitle:
              legacy.issueSubtitle ??
              "URBAN APPAREL",
            productId: "",
            titleStyle: "display",
          },
          0
        ),
      ];
    }
  }

  if (finalSlides.length === 0) {
    finalSlides = DEFAULT_SETTINGS.hero.slides;
  }

  return {
    enabled: booleanValue(
      source.enabled,
      DEFAULT_SETTINGS.hero.enabled
    ),
    autoplay: booleanValue(
      source.autoplay,
      DEFAULT_SETTINGS.hero.autoplay
    ),
    autoplayDuration: Math.min(
      30000,
      Math.max(
        2000,
        numberValue(
          source.autoplayDuration,
          DEFAULT_SETTINGS.hero.autoplayDuration
        )
      )
    ),
    transitionDuration: Math.min(
      3000,
      Math.max(
        200,
        numberValue(
          source.transitionDuration,
          DEFAULT_SETTINGS.hero.transitionDuration
        )
      )
    ),
    transition:
      source.transition === "slide" ||
      source.transition === "fade"
        ? source.transition
        : DEFAULT_SETTINGS.hero.transition,
    slides: finalSlides,
  };
}

function normalizeDrop(
  value: unknown
): DropSettings {
  const source = isRecord(value)
    ? value
    : {};

  const rawProducts = Array.isArray(
    source.products
  )
    ? source.products
    : [];

  const products: DropProduct[] = rawProducts
    .slice(0, 20)
    .map((item, index) => {
      const record = isRecord(item)
        ? item
        : {};

      return {
        enabled: booleanValue(
          record.enabled,
          true
        ),
        productId: stringValue(
          record.productId
        ),
        title: stringValue(
          record.title
        ),
        link: stringValue(
          record.link
        ),
        titleStyle: normalizeFontStyle(
          record.titleStyle
        ),
        order: numberValue(
          record.order,
          index
        ),
      };
    })
    .sort(
      (a, b) => a.order - b.order
    )
    .map((product, index) => ({
      ...product,
      order: index,
    }));

  return {
    enabled: booleanValue(
      source.enabled,
      DEFAULT_SETTINGS.drop.enabled
    ),
    label: stringValue(
      source.label,
      DEFAULT_SETTINGS.drop.label
    ),
    title: stringValue(
      source.title,
      DEFAULT_SETTINGS.drop.title
    ),
    products,
  };
}

function normalizeMangostaStudios(
  value: unknown
): MangostaStudio[] {
  const raw = Array.isArray(value)
    ? value
    : [];

  return raw
    .map((item, index) => {
      if (!isRecord(item)) {
        return null;
      }

      return {
        enabled: booleanValue(
          item.enabled,
          true
        ),
        productId: stringValue(
          item.productId
        ),
        title: stringValue(
          item.title
        ),
        image: stringValue(
          item.image
        ),
        tag: stringValue(
          item.tag
        ),
        titleStyle: normalizeFontStyle(
          item.titleStyle
        ),
        link: stringValue(
          item.link
        ),
        order: numberValue(
          item.order,
          index
        ),
      } satisfies MangostaStudio;
    })
    .filter(
      (studio): studio is MangostaStudio =>
        studio !== null
    )
    .sort(
      (a, b) => a.order - b.order
    )
    .map((studio, index) => ({
      ...studio,
      order: index,
    }));
}

function normalizeMangostaCode(
  value: unknown
): MangostaCodeBox[] {
  const raw = Array.isArray(value)
    ? value
    : [];

  return [0, 1, 2].map((index) => {
    const item = isRecord(raw[index])
      ? raw[index]
      : {};

    return {
      enabled: booleanValue(
        item.enabled,
        true
      ),
      heading: stringValue(
        item.heading
      ),
      description: stringValue(
        item.description
      ),
      headingStyle: normalizeFontStyle(
        item.headingStyle
      ),
      descriptionStyle: normalizeFontStyle(
        item.descriptionStyle,
        "body"
      ),
      productId: stringValue(
        item.productId
      ),
    };
  });
}

function normalizeSiteSettings(
  saved: unknown
): SiteSettings {
  const source = isRecord(saved)
    ? saved
    : {};

  return {
    ...DEFAULT_SETTINGS,

    hero: normalizeHeroSettings(
      source.hero
    ),

    heroHeadline: stringValue(
      source.heroHeadline,
      DEFAULT_SETTINGS.heroHeadline
    ),

    heroSubline: stringValue(
      source.heroSubline,
      DEFAULT_SETTINGS.heroSubline
    ),

    announcementBar: stringValue(
      source.announcementBar,
      DEFAULT_SETTINGS.announcementBar
    ),

    announcementEnabled: booleanValue(
      source.announcementEnabled,
      DEFAULT_SETTINGS.announcementEnabled
    ),

    collectionEnabled: booleanValue(
      source.collectionEnabled,
      DEFAULT_SETTINGS.collectionEnabled
    ),

    collectionLabel: stringValue(
      source.collectionLabel,
      DEFAULT_SETTINGS.collectionLabel
    ),

    collectionTitle: stringValue(
      source.collectionTitle,
      DEFAULT_SETTINGS.collectionTitle
    ),

    collectionSubtitle: stringValue(
      source.collectionSubtitle,
      DEFAULT_SETTINGS.collectionSubtitle
    ),

    collectionDescription: stringValue(
      source.collectionDescription,
      DEFAULT_SETTINGS.collectionDescription
    ),

    collectionImage: stringValue(
      source.collectionImage,
      DEFAULT_SETTINGS.collectionImage
    ),

    collectionOverlayEnabled: booleanValue(
      source.collectionOverlayEnabled,
      DEFAULT_SETTINGS.collectionOverlayEnabled
    ),

    collectionOverlayOpacity: Math.min(
      100,
      Math.max(
        0,
        numberValue(
          source.collectionOverlayOpacity,
          DEFAULT_SETTINGS.collectionOverlayOpacity
        )
      )
    ),

    mangostaCode: normalizeMangostaCode(
      source.mangostaCode
    ),

    drop: normalizeDrop(
      source.drop
    ),

    mangostaStudiosEnabled: booleanValue(
      source.mangostaStudiosEnabled,
      DEFAULT_SETTINGS.mangostaStudiosEnabled
    ),

    mangostaStudiosLabel: stringValue(
      source.mangostaStudiosLabel,
      DEFAULT_SETTINGS.mangostaStudiosLabel
    ),

    mangostaStudios:
      normalizeMangostaStudios(
        source.mangostaStudios
      ),

    newsletterEnabled: booleanValue(
      source.newsletterEnabled,
      DEFAULT_SETTINGS.newsletterEnabled
    ),

    newsletterSubject: stringValue(
      source.newsletterSubject,
      DEFAULT_SETTINGS.newsletterSubject
    ),

    newsletterHeading: stringValue(
      source.newsletterHeading,
      DEFAULT_SETTINGS.newsletterHeading
    ),

    newsletterBody: stringValue(
      source.newsletterBody,
      DEFAULT_SETTINGS.newsletterBody
    ),

    newsletterButtonText: stringValue(
      source.newsletterButtonText,
      DEFAULT_SETTINGS.newsletterButtonText
    ),

    newsletterButtonUrl: stringValue(
      source.newsletterButtonUrl,
      DEFAULT_SETTINGS.newsletterButtonUrl
    ),

    newsletterFooterText: stringValue(
      source.newsletterFooterText,
      DEFAULT_SETTINGS.newsletterFooterText
    ),

    newsletterNotificationEmail:
      stringValue(
        source.newsletterNotificationEmail,
        DEFAULT_SETTINGS.newsletterNotificationEmail
      ),

    newsletterNotificationEnabled:
      booleanValue(
        source.newsletterNotificationEnabled,
        DEFAULT_SETTINGS.newsletterNotificationEnabled
      ),
  };
}

async function migrateSettingsFromJson(): Promise<void> {
  const migrationId = "settings-json-to-mongodb";
  if (await isMigrated(migrationId)) {
    return;
  }

  const db = await getDb();
  const collection = db.collection<any>(
    "siteSettings"
  );

  const existing = await collection.findOne({
    _id: "default",
  });

  if (!existing) {
    const legacy = await readJson<
      Partial<SiteSettings>
    >(SETTINGS_PATH, {});

    const normalized =
      normalizeSiteSettings(legacy);

    await collection.replaceOne(
      { _id: "default" },
      {
        ...normalized,
        _id: "default",
      },
      { upsert: true }
    );
  }

  await markMigrated(migrationId);
}

// ============================================================
// SETTINGS
// ============================================================

export async function getSettings(): Promise<SiteSettings> {
  await migrateSettingsFromJson();

  const db = await getDb();
  const collection = db.collection<any>(
    "siteSettings"
  );

  const saved = await collection.findOne({
    _id: "default",
  });

  return normalizeSiteSettings(
    saved ? omitMongoId(saved) : null
  );
}

export async function saveSettings(
  settings: SiteSettings
): Promise<void> {
  const db = await getDb();
  const collection = db.collection<any>(
    "siteSettings"
  );

  const normalized =
    normalizeSiteSettings(settings);

  await collection.replaceOne(
    { _id: "default" },
    {
      ...normalized,
      _id: "default",
    },
    { upsert: true }
  );
}
