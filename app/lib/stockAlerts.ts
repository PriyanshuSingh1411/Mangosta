import "server-only";
import { isValidEmail as isValidEmailAddress } from "@/app/lib/auth/otp";

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
import { stockAlertConfirmPageUrl } from "@/app/lib/emailPreferences";

// "Notify me when back in stock": one document per (product, colour,
// size, email) in the "stockAlerts" collection. After an admin raises
// stock (or a return is restocked) notifyBackInStock() emails everyone
// waiting for a size/colour that is available again.
//
// An alert only counts once its email is confirmed: a signed-in customer
// using their own (verified) email is confirmed at once; anyone else gets
// a confirm link first, so nobody can sign strangers up. Alerts made
// before confirmation existed have no `confirmed` field and count as
// confirmed.

export interface StockAlert {
  _id: string;
  productId: string;
  color: string;
  size: string;
  email: string;
  createdAt: string;
  notifiedAt: string | null;
  /** false = waiting for the confirm link; missing (older alerts) = confirmed. */
  confirmed?: boolean;
  confirmedAt?: string;
}

/** Alerts that may be emailed: not sent yet and not waiting for confirmation. */
const ACTIVE_ALERT = { notifiedAt: null, confirmed: { $ne: false } } as const;

export function isValidEmail(value: string): boolean {
  return isValidEmailAddress(value);
}

async function alertsCollection() {
  const db = await getStoreDb();
  return db.collection<StockAlert>("stockAlerts");
}

/**
 * Adds an alert (or finds the same one still waiting).
 * `confirmed`: true for a signed-in customer's own verified email.
 * Returns the alert id, whether it already existed, and whether it still
 * needs the confirm link.
 */
export async function createStockAlert(input: {
  productId: string;
  color: string;
  size: string;
  email: string;
  confirmed: boolean;
}): Promise<{ alertId: string; alreadyWaiting: boolean; needsConfirmation: boolean }> {
  const collection = await alertsCollection();
  const email = input.email.trim().toLowerCase();
  const now = new Date().toISOString();

  const existing = await collection.findOne({
    productId: input.productId,
    color: input.color,
    size: input.size,
    email,
    notifiedAt: null,
  });

  if (existing) {
    if (existing.confirmed === false && input.confirmed) {
      await collection.updateOne(
        { _id: existing._id },
        { $set: { confirmed: true, confirmedAt: now } }
      );
      return { alertId: existing._id, alreadyWaiting: true, needsConfirmation: false };
    }
    return {
      alertId: existing._id,
      alreadyWaiting: existing.confirmed !== false,
      needsConfirmation: existing.confirmed === false,
    };
  }

  const alert: StockAlert = {
    _id: shortId("SA"),
    productId: input.productId,
    color: input.color,
    size: input.size,
    email,
    createdAt: now,
    notifiedAt: null,
    confirmed: input.confirmed,
    ...(input.confirmed ? { confirmedAt: now } : {}),
  };
  await collection.insertOne(alert);

  return { alertId: alert._id, alreadyWaiting: false, needsConfirmation: !input.confirmed };
}

/** The owner confirmed from the email link. Returns the alert, or null. */
export async function confirmStockAlert(
  alertId: string,
  email: string
): Promise<StockAlert | null> {
  const collection = await alertsCollection();
  const address = email.trim().toLowerCase();

  await collection.updateOne(
    { _id: alertId, email: address, confirmed: false },
    { $set: { confirmed: true, confirmedAt: new Date().toISOString() } }
  );

  return collection.findOne({ _id: alertId, email: address });
}

/** "Confirm your back-in-stock alert" email (transactional). */
export async function sendStockAlertConfirmEmail(input: {
  alertId: string;
  email: string;
  productName: string;
  detail: string;
}): Promise<void> {
  const url = stockAlertConfirmPageUrl(input.alertId, input.email);
  const what = input.detail ? `${input.productName} (${input.detail})` : input.productName;

  await sendStoreEmail({
    to: input.email,
    subject: "Confirm your back-in-stock alert",
    text: `Confirm and we'll email you once when ${what} is back in stock: ${url}\n\nDidn't ask for this? Ignore this email - you won't hear from us.`,
    html: storeEmailLayout({
      eyebrow: "MANGOSTA / BACK IN STOCK",
      heading: "CONFIRM YOUR ALERT",
      intro: `Confirm and we'll email you once when ${what} is back in stock.\n\nDidn't ask for this? Ignore this email - you won't hear from us.`,
      buttonText: "CONFIRM ALERT",
      buttonUrl: url,
    }),
  });
}

export async function countWaitingAlerts(): Promise<number> {
  const collection = await alertsCollection();
  return collection.countDocuments(ACTIVE_ALERT);
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
      .find({ productId, ...ACTIVE_ALERT })
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
