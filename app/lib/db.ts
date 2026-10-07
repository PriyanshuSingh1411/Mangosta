import { randomBytes } from "crypto";
import clientPromise from "@/app/lib/mongodb";

/** The store's MongoDB database (same one dataStore.ts uses). */
export async function getStoreDb() {
  const client = await clientPromise;
  return client.db("mangosta");
}

/** Absolute site URL for links inside emails. */
export function getSiteUrl(): string {
  const configured =
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : "") ||
    "https://mangosta.vercel.app";

  return configured.replace(/\/+$/, "");
}

/** Short unique id, e.g. "RT-MG4X2K-7F3A9C". */
export function shortId(prefix: string): string {
  const time = Date.now().toString(36).toUpperCase();
  const random = randomBytes(3).toString("hex").toUpperCase();
  return `${prefix}-${time}-${random}`;
}
