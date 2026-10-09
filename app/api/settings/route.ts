import { NextResponse } from "next/server";
import { getSettings, type SiteSettings } from "@/app/lib/dataStore";

export const dynamic = "force-dynamic";

/**
 * The settings the storefront shows (home page sections, announcement,
 * drop, rail, studios). Anything internal - the shop's notification email,
 * the welcome-email template - stays server-side and is only available to
 * the admin (Admin → Email).
 */
const PUBLIC_KEYS = [
  "hero",
  "heroHeadline",
  "heroSubline",
  "announcementBar",
  "announcementEnabled",
  "collectionEnabled",
  "collectionLabel",
  "collectionTitle",
  "collectionSubtitle",
  "collectionDescription",
  "collectionImage",
  "collectionOverlayEnabled",
  "collectionOverlayOpacity",
  "mangostaCode",
  "drop",
  "rail",
  "mangostaStudiosEnabled",
  "mangostaStudiosLabel",
  "mangostaStudios",
  "newsletterEnabled",
] as const satisfies readonly (keyof SiteSettings)[];

export async function GET() {
  try {
    const settings = await getSettings();

    const publicSettings = Object.fromEntries(
      PUBLIC_KEYS.map((key) => [key, settings[key]])
    );

    return NextResponse.json(publicSettings, {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    });
  } catch (error) {
    console.error("Public settings error:", error);

    return NextResponse.json(
      {
        error: "Failed to load settings",
      },
      {
        status: 500,
      }
    );
  }
}
