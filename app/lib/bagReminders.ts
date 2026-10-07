import "server-only";

import { getStoreDb, getSiteUrl } from "@/app/lib/db";
import { getOrders, getProducts } from "@/app/lib/dataStore";
import { getStoreConfig } from "@/app/lib/storeConfig";
import type { AuthUser } from "@/app/lib/auth/session";
import {
  isEmailConfigured,
  sendStoreEmail,
  storeEmailLayout,
  storeEmailProductRow,
} from "@/app/lib/auth/mail";
import { getLineImage } from "@/app/data/productTypes";

// Abandoned-bag reminders.
//   - Signed-in customers' bags are copied to the "carts" collection
//     whenever they change (see /api/cart).
//   - Once a day (Vercel Cron → /api/cron/abandoned-bags) or from the
//     admin "Send reminders now" button, every bag untouched for at least
//     the configured hours gets ONE reminder email. Changing the bag again
//     makes it eligible for a new reminder later.

export interface SavedCartLine {
  productId: string;
  color: string;
  size: string;
  quantity: number;
}

type CartDocument = {
  _id: string; // user id
  email: string;
  firstName: string;
  lines: SavedCartLine[];
  updatedAt: string;
  remindedAt: string | null;
};

type JobRunDocument = {
  _id: string;
  at: string;
  result: BagReminderResult;
};

export interface BagReminderResult {
  checked: number;
  sent: number;
  skipped: number;
  failed: number;
  note: string;
}

async function db() {
  return getStoreDb();
}

function sameLines(a: SavedCartLine[], b: SavedCartLine[]): boolean {
  const key = (lines: SavedCartLine[]) =>
    JSON.stringify(
      [...lines]
        .map((line) => [line.productId, line.color, line.size, line.quantity])
        .sort()
    );
  return key(a) === key(b);
}

export async function saveCustomerCart(user: AuthUser, lines: SavedCartLine[]): Promise<void> {
  const collection = (await db()).collection<CartDocument>("carts");

  if (lines.length === 0) {
    await collection.deleteOne({ _id: user.id });
    return;
  }

  const existing = await collection.findOne({ _id: user.id });
  if (existing && sameLines(existing.lines, lines)) return;

  await collection.updateOne(
    { _id: user.id },
    {
      $set: {
        email: user.email.trim().toLowerCase(),
        firstName: user.firstName,
        lines,
        updatedAt: new Date().toISOString(),
        remindedAt: null,
      },
    },
    { upsert: true }
  );
}

export async function getBagReminderStats(): Promise<{
  waiting: number;
  lastRun: JobRunDocument | null;
}> {
  const database = await db();
  const waiting = await database
    .collection<CartDocument>("carts")
    .countDocuments({ remindedAt: null });
  const lastRun = await database
    .collection<JobRunDocument>("jobRuns")
    .findOne({ _id: "bagReminders" });

  return { waiting, lastRun };
}

export async function runBagReminders(): Promise<BagReminderResult> {
  const result: BagReminderResult = { checked: 0, sent: 0, skipped: 0, failed: 0, note: "" };
  const config = await getStoreConfig("emailAutomation");
  const database = await db();

  if (!config.abandonedBagEnabled) {
    result.note = "Bag reminders are switched off.";
  } else if (!isEmailConfigured()) {
    result.note = "Email (SMTP) is not configured, so no reminders were sent.";
  } else {
    const cutoff = new Date(Date.now() - config.abandonedBagDelayHours * 3_600_000).toISOString();
    const carts = database.collection<CartDocument>("carts");
    const due = await carts.find({ remindedAt: null, updatedAt: { $lte: cutoff } }).toArray();

    const [products, orders] = await Promise.all([getProducts(), getOrders()]);
    const productsById = new Map(products.map((product) => [product.id, product]));
    const siteUrl = getSiteUrl();

    for (const cart of due) {
      result.checked += 1;

      // Bought since the bag was saved? Then there is nothing to remind.
      const ordered = orders.some(
        (order) =>
          order.customer.email.trim().toLowerCase() === cart.email &&
          order.createdAt >= cart.updatedAt
      );

      const items = cart.lines
        .map((line) => ({ line, product: productsById.get(line.productId) }))
        .filter((entry) => entry.product);

      if (ordered || items.length === 0) {
        await carts.deleteOne({ _id: cart._id });
        result.skipped += 1;
        continue;
      }

      const rows = items
        .slice(0, 4)
        .map(({ line, product }) =>
          storeEmailProductRow({
            image: getLineImage(product!, line.color),
            name: product!.name,
            detail: [line.color, line.size, `Qty ${line.quantity}`].filter(Boolean).join(" / "),
          })
        )
        .join("");

      const more = items.length > 4 ? `<p style="font-size:12px;color:#9d998f;margin:12px 0 0;">+ ${items.length - 4} more</p>` : "";

      try {
        await sendStoreEmail({
          to: cart.email,
          subject: config.abandonedBagSubject,
          text: `${config.abandonedBagBody}\n\nYour bag: ${siteUrl}/bag`,
          html: storeEmailLayout({
            eyebrow: "MANGOSTA / YOUR BAG",
            heading: config.abandonedBagHeading || "YOUR BAG IS WAITING",
            intro: `${cart.firstName ? `Hi ${cart.firstName},\n` : ""}${config.abandonedBagBody}`,
            contentHtml: rows + more,
            buttonText: config.abandonedBagButtonText,
            buttonUrl: `${siteUrl}/bag`,
          }),
        });

        await carts.updateOne({ _id: cart._id }, { $set: { remindedAt: new Date().toISOString() } });
        result.sent += 1;
      } catch (error) {
        console.error(`[BAG REMINDER] Could not email ${cart.email}:`, error);
        result.failed += 1;
      }
    }

    result.note =
      result.checked === 0
        ? `No bags have been waiting ${config.abandonedBagDelayHours}+ hours.`
        : `Sent ${result.sent} reminder(s).`;
  }

  await database
    .collection<JobRunDocument>("jobRuns")
    .updateOne(
      { _id: "bagReminders" },
      { $set: { at: new Date().toISOString(), result } },
      { upsert: true }
    );

  return result;
}
