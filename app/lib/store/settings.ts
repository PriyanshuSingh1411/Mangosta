import "server-only";

import { SETTINGS_PATH, getDb, isMigrated, markMigrated, omitMongoId, readJson } from "./core";

// Site settings: hero carousel, rail, drop, announcement bar and the other
// homepage sections managed from Admin → Settings.

type SiteSettingsDocument = SiteSettings & {
  _id: "default";
};

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
// ON THE RAIL (homepage clothes-rail section)
// ============================================================

/** Maximum garments that can hang on the rail. */
export const RAIL_MAX_ITEMS = 20;

export interface RailItem {
  enabled: boolean;
  productId: string;
  /** Optional display name. Empty = product name. */
  title: string;
  /** Optional hanger image (front). Empty = product's 1st image. */
  frontImage: string;
  /** Optional hanger image (back). Empty = product's 2nd image. */
  backImage: string;
  order: number;
}

export interface RailSettings {
  enabled: boolean;
  label: string;
  secondaryLabel: string;
  buttonText: string;
  buttonUrl: string;
  /** Draws a hanger hook above every garment. */
  showHangers: boolean;
  /** false = rail hidden on phones (< 768px); tablets/computers still show it. */
  showOnMobile: boolean;
  /** Empty list = every product with an image hangs on the rail. */
  items: RailItem[];
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
  rail: RailSettings;
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

  rail: {
    enabled: true,
    label: "02 — ON THE RAIL",
    secondaryLabel: "MANGOSTA / FW26",
    buttonText: "EXPLORE MANGOSTA",
    buttonUrl: "/shop",
    showHangers: true,
    showOnMobile: true,
    items: [],
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

/**
 * Cleans the "On the Rail" settings. Exported so the admin API route
 * uses exactly the same rules as the storefront.
 */
export function normalizeRail(
  value: unknown
): RailSettings {
  const source = isRecord(value)
    ? value
    : {};

  const rawItems = Array.isArray(
    source.items
  )
    ? source.items
    : [];

  const items: RailItem[] = rawItems
    .slice(0, RAIL_MAX_ITEMS)
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
        ).trim(),
        title: stringValue(
          record.title
        ),
        frontImage: stringValue(
          record.frontImage
        ).trim(),
        backImage: stringValue(
          record.backImage
        ).trim(),
        order: numberValue(
          record.order,
          index
        ),
      };
    })
    .sort(
      (a, b) => a.order - b.order
    )
    .map((item, index) => ({
      ...item,
      order: index,
    }));

  return {
    enabled: booleanValue(
      source.enabled,
      DEFAULT_SETTINGS.rail.enabled
    ),
    label: stringValue(
      source.label,
      DEFAULT_SETTINGS.rail.label
    ),
    secondaryLabel: stringValue(
      source.secondaryLabel,
      DEFAULT_SETTINGS.rail.secondaryLabel
    ),
    buttonText: stringValue(
      source.buttonText,
      DEFAULT_SETTINGS.rail.buttonText
    ),
    buttonUrl: stringValue(
      source.buttonUrl,
      DEFAULT_SETTINGS.rail.buttonUrl
    ),
    showHangers: booleanValue(
      source.showHangers,
      DEFAULT_SETTINGS.rail.showHangers
    ),
    showOnMobile: booleanValue(
      source.showOnMobile,
      DEFAULT_SETTINGS.rail.showOnMobile
    ),
    items,
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

    rail: normalizeRail(
      source.rail
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
  const collection = db.collection<SiteSettingsDocument>(
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
  const collection = db.collection<SiteSettingsDocument>(
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
  const collection = db.collection<SiteSettingsDocument>(
    "siteSettings"
  );

  const normalized =
    normalizeSiteSettings(settings);

  await collection.replaceOne(
    { _id: "default" },
    {
      ...normalized,
    },
    { upsert: true }
  );
}
