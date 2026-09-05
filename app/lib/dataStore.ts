import { readFile, writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import clientPromise from "@/app/lib/mongodb";
import type { Product } from "@/app/data/productTypes";

export { slugify } from "@/app/data/productTypes";

// Server-only. This file must never be imported from a "use client" component.
// It is the single source of truth for product/order/settings data.
const DATA_DIR = path.join(process.cwd(), "data");
const PRODUCTS_PATH = path.join(DATA_DIR, "products.json");
const ORDERS_PATH = path.join(DATA_DIR, "orders.json");
const COUPONS_PATH = path.join(DATA_DIR, "coupons.json");
const SETTINGS_PATH = path.join(DATA_DIR, "settings.json");

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

  // Main campaign image. Use a Cloudinary URL from the Admin Panel.
  image: string;

  // Editorial metadata.
  topLabel: string;
  secondaryLabel: string;

  // Three-line headline keeps the existing editorial layout flexible.
  headlineLine1: string;
  headlineLine2: string;
  headlineLine3: string;

  description: string;

  // Call-to-action.
  buttonText: string;
  buttonUrl: string;

  // Small campaign/issue metadata.
  issueLabel: string;
  issueSubtitle: string;

  // Optional product attached to this slide.
  productId: string;

  // Optional visual style for the slide headline.
  titleStyle: HeroFontStyle;
}

export interface HeroSettings {
  enabled: boolean;
  autoplay: boolean;
  autoplayDuration: number;
  transitionDuration: number;
  transition: "fade" | "slide";
  slides: HeroSlide[];
}

// Legacy hero fields kept only so older settings.json data can be migrated
// safely into the new carousel structure. These are not part of HeroSettings.
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
// MANGOSTA CODE
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

  // Product selected from the Admin Panel.
  productId: string;

  // Display content.
  title: string;
  image: string;

  // Small label displayed above the title.
  tag: string;

  // Font style used for the title.
  titleStyle: MangostaCodeStyle;

  // Custom destination for the card.
  // If empty, the frontend can use the product URL.
  link: string;

  // Controls the display order.
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
// FILE HELPERS
// ============================================================

async function ensureDataDir() {
  if (!existsSync(DATA_DIR)) {
    await mkdir(DATA_DIR, { recursive: true });
  }
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

// Writes are queued through a single in-process promise chain per file,
// so concurrent admin requests can't interleave and corrupt a JSON file.
// This is sufficient for a single Node process. A real multi-instance
// deployment should use a real database instead of flat JSON files.
const writeQueues = new Map<string, Promise<unknown>>();

async function writeJson<T>(
  filePath: string,
  data: T
): Promise<void> {
  await ensureDataDir();

  const prior =
    writeQueues.get(filePath) ?? Promise.resolve();

  const next = prior
    .catch(() => {})
    .then(() =>
      writeFile(
        filePath,
        JSON.stringify(data, null, 2) + "\n",
        "utf-8"
      )
    );

  writeQueues.set(filePath, next);

  await next;
}

// ============================================================
// PRODUCTS
// ============================================================

async function getProductsCollection() {
  const client = await clientPromise;
  const db = client.db("mangosta");

  return db.collection<Product>("products");
}

async function migrateProductsFromJson(): Promise<void> {
  const client = await clientPromise;
  const db = client.db("mangosta");

  const productsCollection =
    db.collection<Product>("products");

  const migrationsCollection =
    db.collection<any>("migrations");

  const migrationId =
    "products-json-to-mongodb";

  const alreadyMigrated =
    await migrationsCollection.findOne({
      _id: migrationId,
    });

  if (alreadyMigrated) {
    return;
  }

  const products = await readJson<Product[]>(
    PRODUCTS_PATH,
    []
  );

  if (products.length > 0) {
    await productsCollection.insertMany(products);
  }

  await migrationsCollection.insertOne({
    _id: migrationId,
    completedAt: new Date(),
  });
}

export async function getProducts(): Promise<Product[]> {
  await migrateProductsFromJson();

  const collection =
    await getProductsCollection();

  return collection
    .find(
      {},
      {
        projection: {
          _id: 0,
        },
      }
    )
    .sort({
      id: 1,
    })
    .toArray();
}

export async function saveProducts(
  products: Product[]
): Promise<void> {
  const collection =
    await getProductsCollection();

  await collection.deleteMany({});

  if (products.length > 0) {
    await collection.insertMany(products);
  }
}

export async function getProduct(
  id: string
): Promise<Product | undefined> {
  const collection =
    await getProductsCollection();

  const product = await collection.findOne(
    { id },
    {
      projection: {
        _id: 0,
      },
    }
  );

  return product ?? undefined;
}

export async function upsertProduct(
  product: Product
): Promise<Product[]> {
  const collection =
    await getProductsCollection();

  await collection.replaceOne(
    { id: product.id },
    product,
    {
      upsert: true,
    }
  );

  return collection
    .find(
      {},
      {
        projection: {
          _id: 0,
        },
      }
    )
    .sort({
      id: 1,
    })
    .toArray();
}

export async function deleteProduct(
  id: string
): Promise<Product[]> {
  const collection =
    await getProductsCollection();

  await collection.deleteOne({
    id,
  });

  return collection
    .find(
      {},
      {
        projection: {
          _id: 0,
        },
      }
    )
    .sort({
      id: 1,
    })
    .toArray();
}

export function generateProductId(
  existing: Product[]
): string {
  const nums = existing
    .map((p) =>
      parseInt(
        p.id.replace(/^p-/, ""),
        10
      )
    )
    .filter(
      (n) => !Number.isNaN(n)
    );

  const max =
    nums.length > 0
      ? Math.max(...nums)
      : 0;

  return `p-${String(max + 1).padStart(3, "0")}`;
}

// ============================================================
// ORDERS
// ============================================================

export async function getOrders(): Promise<Order[]> {
  const orders =
    await readJson<Order[]>(
      ORDERS_PATH,
      []
    );

  // Newest first for admin display.
  return [...orders].sort(
    (a, b) =>
      b.createdAt.localeCompare(
        a.createdAt
      )
  );
}

export async function saveOrders(
  orders: Order[]
): Promise<void> {
  await writeJson(
    ORDERS_PATH,
    orders
  );
}

export async function createOrder(
  order: Omit<
    Order,
    "id" | "createdAt" | "status"
  >
): Promise<Order> {
  const orders =
    await readJson<Order[]>(
      ORDERS_PATH,
      []
    );

  const newOrder: Order = {
    ...order,
    id: `MG-${Date.now()
      .toString(36)
      .toUpperCase()}`,
    createdAt:
      new Date().toISOString(),
    status: "pending",
  };

  orders.push(newOrder);

  await saveOrders(orders);

  // Decrement inventory for each purchased line.
  const products =
    await getProducts();

  let changed = false;

  for (const line of order.lines) {
    const product =
      products.find(
        (p) =>
          p.id === line.productId
      );

    if (product) {
      product.inventory =
        Math.max(
          0,
          product.inventory -
            line.quantity
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
  const orders =
    await readJson<Order[]>(
      ORDERS_PATH,
      []
    );

  const next =
    orders.map((o) =>
      o.id === id
        ? {
            ...o,
            status,
          }
        : o
    );

  await saveOrders(next);

  return next;
}

// ============================================================
// CHECKOUT / SHIPPING SETTINGS
// ============================================================

const CHECKOUT_SETTINGS_PATH = path.join(
  DATA_DIR,
  "checkout.json"
);

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

export async function getCheckoutSettings(): Promise<CheckoutSettings> {
  const saved = await readJson<Partial<CheckoutSettings>>(
    CHECKOUT_SETTINGS_PATH,
    {}
  );

  const rawRules = Array.isArray(saved.rules)
    ? saved.rules
    : [];

  const rules: ShippingRule[] = rawRules
    .map((rule, index) => ({
      id:
        typeof rule.id === "string" && rule.id.trim()
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
    .sort((a, b) => b.minOrderValue - a.minOrderValue);

  return {
    enabled:
      typeof saved.enabled === "boolean"
        ? saved.enabled
        : DEFAULT_CHECKOUT_SETTINGS.enabled,
    defaultShipping:
      typeof saved.defaultShipping === "number" &&
      Number.isFinite(saved.defaultShipping) &&
      saved.defaultShipping >= 0
        ? saved.defaultShipping
        : DEFAULT_CHECKOUT_SETTINGS.defaultShipping,
    freeShippingEnabled:
      typeof saved.freeShippingEnabled === "boolean"
        ? saved.freeShippingEnabled
        : DEFAULT_CHECKOUT_SETTINGS.freeShippingEnabled,
    freeShippingThreshold:
      typeof saved.freeShippingThreshold === "number" &&
      Number.isFinite(saved.freeShippingThreshold) &&
      saved.freeShippingThreshold >= 0
        ? saved.freeShippingThreshold
        : DEFAULT_CHECKOUT_SETTINGS.freeShippingThreshold,
    rules,
  };
}

export async function saveCheckoutSettings(
  settings: CheckoutSettings
): Promise<void> {
  await writeJson(CHECKOUT_SETTINGS_PATH, settings);
}

export function calculateShipping(
  subtotal: number,
  settings: CheckoutSettings
): number {
  const safeSubtotal = Math.max(0, Number(subtotal) || 0);

  if (!settings.enabled) {
    return 0;
  }

  if (
    settings.freeShippingEnabled &&
    safeSubtotal >= settings.freeShippingThreshold
  ) {
    return 0;
  }

  const matchingRule = settings.rules
    .filter((rule) => rule.enabled)
    .sort((a, b) => b.minOrderValue - a.minOrderValue)
    .find((rule) => safeSubtotal >= rule.minOrderValue);

  return matchingRule
    ? Math.max(0, matchingRule.shippingCost)
    : Math.max(0, settings.defaultShipping);
}

// ============================================================
// COUPONS
// ============================================================

export type CouponDiscountType = "percentage" | "fixed";

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

export const DEFAULT_COUPON: Omit<Coupon, "id"> = {
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

function normalizeCouponCode(value: string): string {
  return value.trim().toUpperCase();
}

function normalizeCoupon(value: Partial<Coupon>, index: number): Coupon {
  const discountType: CouponDiscountType =
    value.discountType === "fixed" ? "fixed" : "percentage";

  const discountValue =
    typeof value.discountValue === "number" && Number.isFinite(value.discountValue)
      ? Math.max(0, value.discountValue)
      : DEFAULT_COUPON.discountValue;

  return {
    id:
      typeof value.id === "string" && value.id.trim()
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
      typeof value.minOrderValue === "number" && Number.isFinite(value.minOrderValue)
        ? Math.max(0, value.minOrderValue)
        : DEFAULT_COUPON.minOrderValue,
    maxDiscount:
      typeof value.maxDiscount === "number" && Number.isFinite(value.maxDiscount)
        ? Math.max(0, value.maxDiscount)
        : DEFAULT_COUPON.maxDiscount,
    startsAt:
      typeof value.startsAt === "string" ? value.startsAt : DEFAULT_COUPON.startsAt,
    expiresAt:
      typeof value.expiresAt === "string" ? value.expiresAt : DEFAULT_COUPON.expiresAt,
    usageLimit:
      typeof value.usageLimit === "number" && Number.isFinite(value.usageLimit)
        ? Math.max(0, Math.floor(value.usageLimit))
        : DEFAULT_COUPON.usageLimit,
    usageCount:
      typeof value.usageCount === "number" && Number.isFinite(value.usageCount)
        ? Math.max(0, Math.floor(value.usageCount))
        : DEFAULT_COUPON.usageCount,
  };
}

export async function getCoupons(): Promise<Coupon[]> {
  const saved = await readJson<Partial<Coupon>[]>(COUPONS_PATH, []);

  return saved
    .map((coupon, index) => normalizeCoupon(coupon, index))
    .filter((coupon) => coupon.code.length > 0);
}

export async function saveCoupons(coupons: Coupon[]): Promise<void> {
  await writeJson(COUPONS_PATH, coupons.map((coupon) => normalizeCoupon(coupon, 0)));
}

export function calculateCouponDiscount(
  subtotal: number,
  coupon: Coupon
): number {
  const safeSubtotal = Math.max(0, Number(subtotal) || 0);

  if (safeSubtotal < coupon.minOrderValue) {
    return 0;
  }

  let discount =
    coupon.discountType === "percentage"
      ? (safeSubtotal * coupon.discountValue) / 100
      : coupon.discountValue;

  if (coupon.discountType === "percentage" && coupon.maxDiscount > 0) {
    discount = Math.min(discount, coupon.maxDiscount);
  }

  return Math.min(safeSubtotal, Math.max(0, discount));
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
  const normalizedCode = normalizeCouponCode(code);
  const coupons = await getCoupons();
  const coupon = coupons.find((item) => item.code === normalizedCode);

  if (!coupon) {
    throw new Error("Invalid coupon code.");
  }

  if (!coupon.enabled) {
    throw new Error("This coupon is currently disabled.");
  }

  if (coupon.startsAt) {
    const startsAt = new Date(coupon.startsAt);
    if (!Number.isNaN(startsAt.getTime()) && now < startsAt) {
      throw new Error("This coupon is not active yet.");
    }
  }

  if (coupon.expiresAt) {
    const expiresAt = new Date(coupon.expiresAt);
    if (!Number.isNaN(expiresAt.getTime()) && now > expiresAt) {
      throw new Error("This coupon has expired.");
    }
  }

  if (coupon.usageLimit > 0 && coupon.usageCount >= coupon.usageLimit) {
    throw new Error("This coupon has reached its usage limit.");
  }

  const safeSubtotal = Math.max(0, Number(subtotal) || 0);
  if (safeSubtotal < coupon.minOrderValue) {
    throw new Error(
      `This coupon requires a minimum order of ${coupon.minOrderValue}.`
    );
  }

  const discount = calculateCouponDiscount(safeSubtotal, coupon);

  if (discount <= 0) {
    throw new Error("This coupon does not apply to this order.");
  }

  return { coupon, discount };
}

export async function consumeCoupon(code: string): Promise<Coupon> {
  const normalizedCode = normalizeCouponCode(code);
  const coupons = await getCoupons();
  const index = coupons.findIndex((coupon) => coupon.code === normalizedCode);

  if (index === -1) {
    throw new Error("Coupon not found.");
  }

  const coupon = coupons[index];
  coupon.usageCount += 1;
  coupons[index] = coupon;
  await saveCoupons(coupons);

  return coupon;
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
  heroHeadline:
    "WEAR YOUR CODE",

  heroSubline:
    "MANGOSTA / FW26",

  announcementBar:
    "",

  announcementEnabled:
    false,


  collectionEnabled:
    true,

  collectionLabel:
    "05 — NEW COLLECTION",

  collectionTitle:
    "MANGOSTA",

  collectionSubtitle:
    "FW / 26",

  collectionDescription:
    "A collection built around movement, utility, and identity.",

  collectionImage:
    "",

  collectionOverlayEnabled:
    true,

  collectionOverlayOpacity:
    0.35,

  // ------------------------------
  // THE DROP
  // ------------------------------

  drop: {
    enabled: true,
    label: "03 — THE DROP",
    title: "THE DROP",
    products: [],
  },

  // ------------------------------
  // MANGOSTA STUDIOS
  // ------------------------------

  mangostaStudiosEnabled: true,

  mangostaStudiosLabel:
    "04 — MANGOSTA STUDIOS",

  // Products are selected from the Admin Panel.
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

  // ------------------------------
  // MANGOSTA WORLD / EMAIL
  // ------------------------------

  newsletterEnabled:
    true,

  newsletterSubject:
    "Welcome to the MANGOSTA WORLD",

  newsletterHeading:
    "WELCOME TO THE WORLD",

  newsletterBody:
    "Thank you for joining the MANGOSTA WORLD.\n\nYou are now part of a community built around individuality, design and culture.\n\nStay tuned for new drops, stories and everything happening inside MANGOSTA.",

  newsletterButtonText:
    "EXPLORE MANGOSTA",

  newsletterButtonUrl:
    "/",

  newsletterFooterText:
    "MANGOSTA — WEAR YOUR ATTITUDE.",

  newsletterNotificationEmail:
    "mangostateam@gmail.com",
};

// ============================================================
// SETTINGS
// ============================================================

export async function getSettings(): Promise<SiteSettings> {
  const settings =
    await readJson<Partial<SiteSettings>>(
      SETTINGS_PATH,
      {}
    );

  /*
   * --------------------------------------------------
   * HERO
   * --------------------------------------------------
   */

  // Read the stored hero as a union of the current carousel shape and
  // the legacy single-hero shape. The explicit cast is intentional:
  // settings.json may still contain the older hero fields.
  const savedHero = settings.hero as
    | (Partial<HeroSettings> & LegacyHeroSettings)
    | undefined;

  const rawHeroSlides =
    savedHero && Array.isArray(savedHero.slides)
      ? savedHero.slides
      : [];

  const legacyHeroSlide: HeroSlide | null =
    savedHero && rawHeroSlides.length === 0 &&
    (typeof savedHero.headlineLine1 === "string" ||
      typeof savedHero.heroImage === "string")
      ? {
          id: "hero-slide-1",
          enabled:
            typeof savedHero.enabled === "boolean"
              ? savedHero.enabled
              : true,
          order: 0,
          image:
            typeof savedHero.heroImage === "string"
              ? savedHero.heroImage
              : "",
          topLabel:
            typeof savedHero.topLabel === "string"
              ? savedHero.topLabel
              : DEFAULT_SETTINGS.hero.slides[0].topLabel,
          secondaryLabel:
            typeof savedHero.secondaryLabel === "string"
              ? savedHero.secondaryLabel
              : DEFAULT_SETTINGS.hero.slides[0].secondaryLabel,
          headlineLine1:
            typeof savedHero.headlineLine1 === "string"
              ? savedHero.headlineLine1
              : DEFAULT_SETTINGS.hero.slides[0].headlineLine1,
          headlineLine2:
            typeof savedHero.headlineLine2 === "string"
              ? savedHero.headlineLine2
              : DEFAULT_SETTINGS.hero.slides[0].headlineLine2,
          headlineLine3:
            typeof savedHero.headlineLine3 === "string"
              ? savedHero.headlineLine3
              : DEFAULT_SETTINGS.hero.slides[0].headlineLine3,
          description:
            typeof savedHero.description === "string"
              ? savedHero.description
              : DEFAULT_SETTINGS.hero.slides[0].description,
          buttonText:
            typeof savedHero.buttonText === "string"
              ? savedHero.buttonText
              : DEFAULT_SETTINGS.hero.slides[0].buttonText,
          buttonUrl:
            typeof savedHero.buttonUrl === "string"
              ? savedHero.buttonUrl
              : DEFAULT_SETTINGS.hero.slides[0].buttonUrl,
          issueLabel:
            typeof savedHero.issueLabel === "string"
              ? savedHero.issueLabel
              : DEFAULT_SETTINGS.hero.slides[0].issueLabel,
          issueSubtitle:
            typeof savedHero.issueSubtitle === "string"
              ? savedHero.issueSubtitle
              : DEFAULT_SETTINGS.hero.slides[0].issueSubtitle,
          productId: "",
          titleStyle: "display",
        }
      : null;

  const heroSlides: HeroSlide[] = rawHeroSlides
    .map((slide, index) => ({
      id:
        typeof slide.id === "string" && slide.id.trim()
          ? slide.id
          : `hero-slide-${index + 1}`,

      enabled:
        typeof slide.enabled === "boolean"
          ? slide.enabled
          : true,

      order:
        typeof slide.order === "number"
          ? slide.order
          : index,

      image:
        typeof slide.image === "string"
          ? slide.image
          : "",

      topLabel:
        typeof slide.topLabel === "string"
          ? slide.topLabel
          : DEFAULT_SETTINGS.hero.slides[0]?.topLabel ?? "",

      secondaryLabel:
        typeof slide.secondaryLabel === "string"
          ? slide.secondaryLabel
          : DEFAULT_SETTINGS.hero.slides[0]?.secondaryLabel ?? "",

      headlineLine1:
        typeof slide.headlineLine1 === "string"
          ? slide.headlineLine1
          : "",

      headlineLine2:
        typeof slide.headlineLine2 === "string"
          ? slide.headlineLine2
          : "",

      headlineLine3:
        typeof slide.headlineLine3 === "string"
          ? slide.headlineLine3
          : "",

      description:
        typeof slide.description === "string"
          ? slide.description
          : "",

      buttonText:
        typeof slide.buttonText === "string"
          ? slide.buttonText
          : "SHOP NOW",

      buttonUrl:
        typeof slide.buttonUrl === "string"
          ? slide.buttonUrl
          : "/shop",

      issueLabel:
        typeof slide.issueLabel === "string"
          ? slide.issueLabel
          : `ISSUE ${String(index + 1).padStart(3, "0")}`,

      issueSubtitle:
        typeof slide.issueSubtitle === "string"
          ? slide.issueSubtitle
          : "URBAN APPAREL",

      productId:
        typeof slide.productId === "string"
          ? slide.productId
          : "",

      titleStyle:
        slide.titleStyle === "display" ||
        slide.titleStyle === "body" ||
        slide.titleStyle === "technical" ||
        slide.titleStyle === "mono"
          ? slide.titleStyle
          : "display",
    }))
    .sort((a, b) => a.order - b.order);

  if (heroSlides.length === 0 && legacyHeroSlide) {
    heroSlides.push(legacyHeroSlide);
  }

  const hero: HeroSettings = {
    enabled:
      typeof savedHero?.enabled === "boolean"
        ? savedHero.enabled
        : DEFAULT_SETTINGS.hero.enabled,

    autoplay:
      typeof savedHero?.autoplay === "boolean"
        ? savedHero.autoplay
        : DEFAULT_SETTINGS.hero.autoplay,

    autoplayDuration:
      typeof savedHero?.autoplayDuration === "number" &&
      savedHero.autoplayDuration >= 1000
        ? savedHero.autoplayDuration
        : DEFAULT_SETTINGS.hero.autoplayDuration,

    transitionDuration:
      typeof savedHero?.transitionDuration === "number" &&
      savedHero.transitionDuration >= 100
        ? savedHero.transitionDuration
        : DEFAULT_SETTINGS.hero.transitionDuration,

    transition:
      savedHero?.transition === "fade" ||
      savedHero?.transition === "slide"
        ? savedHero.transition
        : DEFAULT_SETTINGS.hero.transition,

    slides: heroSlides,
  };

  /*
   * --------------------------------------------------
   * THE DROP
   * --------------------------------------------------
   */

  const rawDrop = settings.drop;
  const rawDropProducts =
    rawDrop && Array.isArray(rawDrop.products)
      ? rawDrop.products
      : [];

  const dropProducts: DropProduct[] = rawDropProducts
    .map((item, index) => ({
      enabled:
        typeof item.enabled === "boolean"
          ? item.enabled
          : true,
      productId:
        typeof item.productId === "string"
          ? item.productId
          : "",
      title:
        typeof item.title === "string"
          ? item.title
          : "",
      link:
        typeof item.link === "string"
          ? item.link
          : "",
      titleStyle:
        item.titleStyle === "display" ||
        item.titleStyle === "body" ||
        item.titleStyle === "technical" ||
        item.titleStyle === "mono"
          ? item.titleStyle
          : "display",
      order:
        typeof item.order === "number"
          ? item.order
          : index,
    }))
    .sort((a, b) => a.order - b.order)
    .map((item, index) => ({
      ...item,
      order: index,
    }));

  const drop: DropSettings = {
    enabled:
      typeof rawDrop?.enabled === "boolean"
        ? rawDrop.enabled
        : DEFAULT_SETTINGS.drop.enabled,
    label:
      typeof rawDrop?.label === "string"
        ? rawDrop.label
        : DEFAULT_SETTINGS.drop.label,
    title:
      typeof rawDrop?.title === "string"
        ? rawDrop.title
        : DEFAULT_SETTINGS.drop.title,
    products: dropProducts,
  };

  /*
   * --------------------------------------------------
   * MANGOSTA STUDIOS
   * --------------------------------------------------
   */

  const rawStudios =
    Array.isArray(settings.mangostaStudios)
      ? settings.mangostaStudios
      : [];

  const mangostaStudios =
    rawStudios
      .map((studio, index) => ({
        enabled:
          typeof studio.enabled === "boolean"
            ? studio.enabled
            : true,

        productId:
          typeof studio.productId === "string"
            ? studio.productId
            : "",

        title:
          typeof studio.title === "string"
            ? studio.title
            : "",

        image:
          typeof studio.image === "string"
            ? studio.image
            : "",

        tag:
          typeof studio.tag === "string"
            ? studio.tag
            : "",

        titleStyle:
          studio.titleStyle === "display" ||
          studio.titleStyle === "body" ||
          studio.titleStyle === "technical" ||
          studio.titleStyle === "mono"
            ? studio.titleStyle
            : "display",

        link:
          typeof studio.link === "string"
            ? studio.link
            : "",

        order:
          typeof studio.order === "number"
            ? studio.order
            : index,
      }))
      .sort(
        (a, b) => a.order - b.order
      );

  /*
   * --------------------------------------------------
   * FINAL SETTINGS
   * --------------------------------------------------
   */

  return {
    ...DEFAULT_SETTINGS,
    ...settings,

    hero,

    drop,

    mangostaStudiosEnabled:
      typeof settings.mangostaStudiosEnabled ===
      "boolean"
        ? settings.mangostaStudiosEnabled
        : DEFAULT_SETTINGS.mangostaStudiosEnabled,

    mangostaStudiosLabel:
      typeof settings.mangostaStudiosLabel ===
      "string"
        ? settings.mangostaStudiosLabel
        : DEFAULT_SETTINGS.mangostaStudiosLabel,

    mangostaStudios,
  };
}

export async function saveSettings(
  settings: SiteSettings
): Promise<void> {
  await writeJson(
    SETTINGS_PATH,
    settings
  );
}