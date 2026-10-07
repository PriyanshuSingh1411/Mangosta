import "server-only";

import { getStoreDb, getSiteUrl, shortId } from "@/app/lib/db";
import { getProduct } from "@/app/lib/dataStore";
import { getStoreConfig } from "@/app/lib/storeConfig";
import {
  isEmailConfigured,
  sendStoreEmail,
  storeEmailLayout,
  storeEmailProductRow,
} from "@/app/lib/auth/mail";
import {
  getLineImage,
  isVariantAvailable,
} from "@/app/data/productTypes";

// "Notify me when back in stock": one document per (product, colour,
// size, email) in the "stockAlerts" collection. After an admin raises
// stock (or a return is restocked) notifyBackInStock() emails everyone
// waiting for a size/colour that is available again.

export interface StockAlert {
  _id: string;
  productId: string;
  color: string;
  size: string;
  email: string;
  createdAt: string;
  notifiedAt: string | null;
}

export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);
}

async function alertsCollection() {
  const db = await getStoreDb();
  return db.collection<StockAlert>("stockAlerts");
}

/** Adds an alert. Returns false when the same alert is already waiting. */
export async function createStockAlert(input: {
  productId: string;
  color: string;
  size: string;
  email: string;
}): Promise<boolean> {
  const collection = await alertsCollection();
  const email = input.email.trim().toLowerCase();

  const existing = await collection.findOne({
    productId: input.productId,
    color: input.color,
    size: input.size,
    email,
    notifiedAt: null,
  });

  if (existing) return false;

  await collection.insertOne({
    _id: shortId("SA"),
    productId: input.productId,
    color: input.color,
    size: input.size,
    email,
    createdAt: new Date().toISOString(),
    notifiedAt: null,
  });

  return true;
}

export async function countWaitingAlerts(): Promise<number> {
  const collection = await alertsCollection();
  return collection.countDocuments({ notifiedAt: null });
}

/**
 * Emails customers whose size/colour is available again.
 * Alerts stay waiting (and are retried next time) when email isn't set up
 * or a send fails.
 */
export async function notifyBackInStock(
  productIds: string[]
): Promise<{ sent: number; failed: number }> {
  const result = { sent: 0, failed: 0 };
  const ids = [...new Set(productIds.filter(Boolean))];
  if (ids.length === 0) return result;

  const config = await getStoreConfig("emailAutomation");
  if (!config.backInStockEnabled || !isEmailConfigured()) return result;

  const collection = await alertsCollection();
  const siteUrl = getSiteUrl();

  for (const productId of ids) {
    const product = await getProduct(productId);
    if (!product) continue;

    const waiting = await collection
      .find({ productId, notifiedAt: null })
      .toArray();

    for (const alert of waiting) {
      if (!isVariantAvailable(product, alert.color, alert.size)) continue;

      const subject = config.backInStockSubject.replace(
        /\{product\}/g,
        product.name
      );
      const url = `${siteUrl}/product/${product.slug}`;
      const detail = [alert.color, alert.size].filter(Boolean).join(" / ");

      try {
        await sendStoreEmail({
          to: alert.email,
          subject,
          text: `${product.name} (${detail}) is back in stock at MANGOSTA. Shop it here: ${url}`,
          html: storeEmailLayout({
            eyebrow: "MANGOSTA / BACK IN STOCK",
            heading: "IT'S BACK.",
            intro: `The piece you were waiting for is available again. Sizes go fast — grab yours before it sells out.`,
            contentHtml: storeEmailProductRow({
              image: getLineImage(product, alert.color),
              name: product.name,
              detail,
            }),
            buttonText: "SHOP NOW",
            buttonUrl: url,
          }),
        });

        await collection.updateOne(
          { _id: alert._id },
          { $set: { notifiedAt: new Date().toISOString() } }
        );
        result.sent += 1;
      } catch (error) {
        console.error(`[STOCK ALERT] Could not email ${alert.email}:`, error);
        result.failed += 1;
      }
    }
  }

  return result;
}
