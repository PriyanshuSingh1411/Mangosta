import { randomBytes } from "crypto";
import clientPromise from "@/app/lib/mongodb";

/** The store's MongoDB database (same one dataStore.ts uses). */
export async function getStoreDb() {
  const client = await clientPromise;
  return client.db("mangosta");
}

/** Absolute site URL for links inside emails (see siteUrl.ts). */
export { getSiteUrl } from "@/app/lib/siteUrl";

/** Short unique id, e.g. "RT-MG4X2K-7F3A9C". */
export function shortId(prefix: string): string {
  const time = Date.now().toString(36).toUpperCase();
  const random = randomBytes(3).toString("hex").toUpperCase();
  return `${prefix}-${time}-${random}`;
}
