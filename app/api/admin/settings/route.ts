import { NextRequest, NextResponse } from "next/server";

import { isAuthenticated } from "@/app/lib/adminAuth";
import {
  getSettings,
  saveSettings,
} from "@/app/lib/dataStore";

import type {
  SiteSettings,
} from "@/app/lib/dataStore";

const FONT_STYLES = [
  "display",
  "body",
  "technical",
  "mono",
] as const;

const TRANSITIONS = [
  "fade",
  "slide",
] as const;

function isRecord(
  value: unknown
): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

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

/*
 * ============================================================
 * HERO SLIDE
 * ============================================================
 */

function sanitizeHeroSlide(
  value: unknown,
  index: number
) {
  const item = isRecord(value)
    ? value
    : {};

  const titleStyle: SiteSettings["hero"]["slides"][number]["titleStyle"] =
    item.titleStyle === "display" ||
    item.titleStyle === "body" ||
    item.titleStyle === "technical" ||
    item.titleStyle === "mono"
      ? item.titleStyle
      : "display";

  return {
    id:
      stringValue(item.id) ||
      `hero-slide-${Date.now()}-${index}`,

    enabled: booleanValue(
      item.enabled,
      true
    ),

    order: numberValue(
      item.order,
      index
    ),

    image: stringValue(
      item.image
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

    productTitle: stringValue(
      item.productTitle
    ),

    productImage: stringValue(
      item.productImage
    ),

    productLink: stringValue(
      item.productLink
    ),

    titleStyle,
  };
}

/*
 * ============================================================
 * GET
 * ============================================================
 */

export async function GET() {
  if (!(await isAuthenticated())) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  const settings = await getSettings();

  return NextResponse.json(settings);
}

/*
 * ============================================================
 * PUT
 * ============================================================
 */

export async function PUT(
  req: NextRequest
) {
  if (!(await isAuthenticated())) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  const body = await req
    .json()
    .catch(() => null);

  if (!isRecord(body)) {
    return NextResponse.json(
      { error: "Invalid body" },
      { status: 400 }
    );
  }

  /*
   * ============================================================
   * HERO CAROUSEL
   * ============================================================
   */

  const rawHero = isRecord(body.hero)
    ? body.hero
    : {};

  /*
   * ------------------------------------------------------------
   * HERO SLIDES
   *
   * Supports multiple slides.
   * Maximum 10 slides to prevent accidental huge payloads.
   * ------------------------------------------------------------
   */

  const rawSlides = Array.isArray(
    rawHero.slides
  )
    ? rawHero.slides
    : [];

  const slides = rawSlides
    .slice(0, 10)
    .map(
      (item, index) =>
        sanitizeHeroSlide(item, index)
    )
    .sort(
      (a, b) =>
        a.order - b.order
    )
    .map(
      (slide, index) => ({
        ...slide,
        order: index,
      })
    );

  /*
   * ------------------------------------------------------------
   * HERO SETTINGS
   * ------------------------------------------------------------
   */

  const autoplayDuration = Math.min(
    30000,
    Math.max(
      2000,
      numberValue(
        rawHero.autoplayDuration,
        6000
      )
    )
  );

  const transitionDuration = Math.min(
    3000,
    Math.max(
      200,
      numberValue(
        rawHero.transitionDuration,
        700
      )
    )
  );

  const transition: SiteSettings["hero"]["transition"] =
  rawHero.transition === "fade" || rawHero.transition === "slide"
    ? rawHero.transition
    : "fade";

  const hero: SiteSettings["hero"] = {
  enabled: booleanValue(
    rawHero.enabled,
    true
  ),

  autoplay: booleanValue(
    rawHero.autoplay,
    true
  ),

  autoplayDuration,

  transitionDuration,

  transition,

  slides,
};

  /*
   * ============================================================
   * THE DROP
   * ============================================================
   */

  const rawDrop = isRecord(body.drop) ? body.drop : {};
  const rawDropProducts = Array.isArray(rawDrop.products)
    ? rawDrop.products
    : [];

  const dropProducts = rawDropProducts
    .slice(0, 20)
    .map((item: unknown, index: number) => {
      const product = isRecord(item) ? item : {};
      const titleStyle: SiteSettings["drop"]["products"][number]["titleStyle"] =
        product.titleStyle === "display" ||
        product.titleStyle === "body" ||
        product.titleStyle === "technical" ||
        product.titleStyle === "mono"
          ? product.titleStyle
          : "display";

      return {
        enabled: booleanValue(product.enabled, true),
        productId: stringValue(product.productId),
        title: stringValue(product.title),
        link: stringValue(product.link),
        titleStyle,
        order: numberValue(product.order, index),
      };
    })
    .sort((a, b) => a.order - b.order)
    .map((product, index) => ({
      ...product,
      order: index,
    }));

  const drop = {
    enabled: booleanValue(rawDrop.enabled, true),
    label: stringValue(rawDrop.label, "03 — THE DROP"),
    title: stringValue(rawDrop.title, "THE DROP"),
    products: dropProducts,
  };

  /*
   * ============================================================
   * MANGOSTA STUDIOS
   * ============================================================
   */

  const rawMangostaStudios =
    Array.isArray(body.mangostaStudios)
      ? body.mangostaStudios
      : [];

  const mangostaStudios =
    rawMangostaStudios
      .map(
        (item: unknown, index: number) => {
          if (!isRecord(item)) {
            return null;
          }

          const titleStyle: SiteSettings["mangostaStudios"][number]["titleStyle"] =
            item.titleStyle === "display" ||
            item.titleStyle === "body" ||
            item.titleStyle === "technical" ||
            item.titleStyle === "mono"
              ? item.titleStyle
              : "display";

          return {
            enabled: booleanValue(
              item.enabled,
              true
            ),

            productId:
              stringValue(
                item.productId
              ),

            title:
              stringValue(
                item.title
              ),

            image:
              stringValue(
                item.image
              ),

            tag:
              stringValue(
                item.tag
              ),

            titleStyle,

            link:
              stringValue(
                item.link
              ),

            order:
              numberValue(
                item.order,
                index
              ),
          };
        }
      )
      .filter(
        (
          studio
        ): studio is NonNullable<
          typeof studio
        > =>
          studio !== null
      )
      .sort(
        (a, b) =>
          a.order - b.order
      )
      .map(
        (studio, index) => ({
          ...studio,
          order: index,
        })
      );

  /*
   * ============================================================
   * MANGOSTA CODE
   * ============================================================
   */

  const rawMangostaCode =
    Array.isArray(body.mangostaCode)
      ? body.mangostaCode
      : [];

  const mangostaCode =
    [0, 1, 2].map(
      (index) => {
        const item =
          isRecord(
            rawMangostaCode[index]
          )
            ? rawMangostaCode[index]
            : {};

        const headingStyle: SiteSettings["mangostaCode"][number]["headingStyle"] =
          item.headingStyle === "display" ||
          item.headingStyle === "body" ||
          item.headingStyle === "technical" ||
          item.headingStyle === "mono"
            ? item.headingStyle
            : "display";

        const descriptionStyle: SiteSettings["mangostaCode"][number]["descriptionStyle"] =
          item.descriptionStyle === "display" ||
          item.descriptionStyle === "body" ||
          item.descriptionStyle === "technical" ||
          item.descriptionStyle === "mono"
            ? item.descriptionStyle
            : "body";

        return {
          enabled: booleanValue(
            item.enabled,
            true
          ),

          heading:
            stringValue(
              item.heading
            ),

          description:
            stringValue(
              item.description
            ),

          headingStyle,

          descriptionStyle,

          productId:
            stringValue(
              item.productId
            ),
        };
      }
    );

  /*
   * ============================================================
   * ALL SETTINGS
   * ============================================================
   */

  const settings = {
    /*
     * HERO CAROUSEL
     */

    hero,

    /*
     * Legacy hero fields
     *
     * Kept so other existing parts of the
     * website do not break.
     */

    heroHeadline:
      stringValue(
        body.heroHeadline,
        "WEAR YOUR CODE"
      ),

    heroSubline:
      stringValue(
        body.heroSubline,
        "MANGOSTA / FW26"
      ),

    /*
     * ANNOUNCEMENT
     */

    announcementBar:
      stringValue(
        body.announcementBar
      ),

    announcementEnabled:
      booleanValue(
        body.announcementEnabled,
        false
      ),

    /*
     * COLLECTION
     */

    collectionEnabled:
      booleanValue(
        body.collectionEnabled,
        true
      ),

    collectionLabel:
      stringValue(
        body.collectionLabel,
        "05 — NEW COLLECTION"
      ),

    collectionTitle:
      stringValue(
        body.collectionTitle,
        "MANGOSTA"
      ),

    collectionSubtitle:
      stringValue(
        body.collectionSubtitle,
        "FW / 26"
      ),

    collectionDescription:
      stringValue(
        body.collectionDescription
      ),

    collectionImage:
      stringValue(
        body.collectionImage
      ),

    collectionOverlayEnabled:
      booleanValue(
        body.collectionOverlayEnabled,
        true
      ),

    collectionOverlayOpacity:
      Math.min(
        100,
        Math.max(
          0,
          numberValue(
            body.collectionOverlayOpacity,
            45
          )
        )
      ),

    /*
     * ============================================================
     * THE DROP
     * ============================================================
     */

    drop,

    /*
     * ============================================================
     * MANGOSTA STUDIOS
     * ============================================================
     */

    mangostaStudiosEnabled:
      booleanValue(
        body.mangostaStudiosEnabled,
        true
      ),

    mangostaStudiosLabel:
      stringValue(
        body.mangostaStudiosLabel,
        "04 — MANGOSTA STUDIOS"
      ),

    mangostaStudios,

    /*
     * ============================================================
     * MANGOSTA CODE
     * ============================================================
     */

    mangostaCode,

    /*
     * ============================================================
     * NEWSLETTER / EMAIL
     * ============================================================
     */

    newsletterEnabled:
      booleanValue(
        body.newsletterEnabled,
        true
      ),

    newsletterSubject:
      stringValue(
        body.newsletterSubject,
        "Welcome to the MANGOSTA WORLD"
      ),

    newsletterHeading:
      stringValue(
        body.newsletterHeading,
        "WELCOME TO THE WORLD"
      ),

    newsletterBody:
      stringValue(
        body.newsletterBody
      ),

    newsletterButtonText:
      stringValue(
        body.newsletterButtonText,
        "EXPLORE MANGOSTA"
      ),

    newsletterButtonUrl:
      stringValue(
        body.newsletterButtonUrl,
        "/"
      ),

    newsletterFooterText:
      stringValue(
        body.newsletterFooterText,
        "MANGOSTA — WEAR YOUR ATTITUDE."
      ),

    newsletterNotificationEnabled:
      booleanValue(
        body.newsletterNotificationEnabled,
        true
      ),

    newsletterNotificationEmail:
      stringValue(
        body.newsletterNotificationEmail,
        "mangostateam@gmail.com"
      ),
  };

  /*
   * ============================================================
   * SAVE
   * ============================================================
   */

  await saveSettings(settings);

  return NextResponse.json(
    settings
  );
}