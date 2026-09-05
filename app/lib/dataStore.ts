import { readFile } from "fs/promises";
import path from "path";
import clientPromise from "@/app/lib/mongodb";
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

export interface OrderLine {
  lineId: string;
  productId: string;
  productName: string;
  slug: string;
  image: string;
  size: string;
  color: string;
  quantity: number;
  price: number;
}

export interface Order {
  id: string;
  createdAt: string;
  status: "pending" | "fulfilled" | "cancelled";
  customer: {
    email: string;
    firstName: string;
    lastName: string;
    address: string;
    city: string;
    postalCode: string;
    mobile: string;
  };
  lines: OrderLine[];
  subtotal: number;
  shipping: number;
  discount?: number;
  couponCode?: string;
  total: number;
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

export interface HeroSlide {
  id: string;
  enabled: boolean;
  order: number;
  image: string;
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

export async function saveProducts(
  products: Product[]
): Promise<void> {
  const collection = await getProductsCollection();

  await collection.deleteMany({});

  if (products.length > 0) {
    await collection.insertMany(products);
  }
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

  return documents.map(
  (document) =>
    omitMongoId(document) as Order
);
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

export async function createOrder(
  order: Omit<
    Order,
    "id" | "createdAt" | "status"
  >
): Promise<Order> {
  const newOrder: Order = {
    ...order,
    customer: {
      ...order.customer,
      mobile: String(
        order.customer?.mobile ?? ""
      ),
    },
    id: `MG-${Date.now()
      .toString(36)
      .toUpperCase()}`,
    createdAt:
      new Date().toISOString(),
    status: "pending",
  };

  const db = await getDb();
  const collection = db.collection<any>("orders");

  await collection.insertOne({
    ...newOrder,
    _id: newOrder.id,
  });

  // Decrement inventory for purchased products.
  const products = await getProducts();
  let changed = false;

  for (const line of newOrder.lines) {
    const product = products.find(
      (item) => item.id === line.productId
    );

    if (product) {
      product.inventory = Math.max(
        0,
        product.inventory - line.quantity
      );
      changed = true;
    }
  }

  if (changed) {
    await saveProducts(products);
  }

  return newOrder;
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

export async function saveCoupons(
  coupons: Coupon[]
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
    await collection.replaceOne(
      { _id: coupon.id },
      {
        ...coupon,
        _id: coupon.id,
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

  return {
    coupon,
    discount,
  };
}

export async function consumeCoupon(
  code: string
): Promise<Coupon> {
  const normalizedCode =
    normalizeCouponCode(code);

  const db = await getDb();
  const collection = db.collection<any>(
    "coupons"
  );

  const coupon = await collection.findOne({
    _id: normalizedCode,
  });

  // Fallback for legacy data where _id was not the coupon code.
  const matched =
    coupon ??
    (await collection.findOne({
      code: normalizedCode,
    }));

  if (!matched) {
    throw new Error(
      "Coupon not found."
    );
  }

  const usageLimit = Math.max(
    0,
    Number(matched.usageLimit) || 0
  );

  // Atomic increment prevents usage from exceeding the configured limit.
  const filter =
    usageLimit > 0
      ? {
          _id: matched._id,
          usageCount: {
            $lt: usageLimit,
          },
        }
      : {
          _id: matched._id,
        };

  const result =
    await collection.findOneAndUpdate(
      filter,
      {
        $inc: {
          usageCount: 1,
        },
      },
      {
        returnDocument: "after",
      }
    );

  if (!result) {
    throw new Error(
      "This coupon has reached its usage limit."
    );
  }

  return normalizeCoupon(
    omitMongoId(result),
    0
  );
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
