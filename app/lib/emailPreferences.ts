import "server-only";
import { createHmac, timingSafeEqual } from "crypto";
import { getSiteUrl, getStoreDb } from "@/app/lib/db";
import { escapeHtml } from "@/app/lib/auth/mail";

// Marketing email consent ("New drops & editorial updates" on the account
// page, the MANGOSTA WORLD newsletter, and bag reminders).
//
//   - A customer gets marketing emails only after opting in: the account
//     box is ticked (preferences.marketingEmails === true), or they joined
//     the newsletter themselves. Never set = no marketing emails.
//   - Every marketing email has an unsubscribe link (+ one-click
//     List-Unsubscribe headers). Unsubscribing records the email in
//     "emailOptOuts", unticks the account box and marks the newsletter
//     subscription "unsubscribed".
//   - Opting in again removes the opt-out: ticking the box (signed in), or
//     confirming a newsletter sign-up from the link sent to that inbox -
//     so nobody can subscribe or re-subscribe someone else.
// Order, delivery, return and sign-in emails are not marketing and are
// always sent.

type OptOutDocument = {
  _id: string; // email
  marketing: true;
  at: string;
  source: "link" | "account";
};

function normalize(email: string): string {
  return String(email ?? "").trim().toLowerCase();
}

function getSecret(): string {
  const secret = process.env.OTP_SECRET;
  if (!secret) {
    throw new Error("Please add OTP_SECRET to .env.local");
  }
  return secret;
}

/** Signature that proves an unsubscribe link was made by this site. */
function unsubscribeToken(email: string): string {
  return createHmac("sha256", getSecret())
    .update(`unsubscribe:v1:${normalize(email)}`)
    .digest("hex");
}

function signatureMatches(expectedToken: string, token: string): boolean {
  const expected = Buffer.from(expectedToken);
  const given = Buffer.from(String(token ?? ""));
  return expected.length === given.length && timingSafeEqual(expected, given);
}

export function isValidUnsubscribeToken(email: string, token: string): boolean {
  if (!normalize(email) || typeof token !== "string") return false;
  return signatureMatches(unsubscribeToken(email), token);
}

/** HMAC of `purpose:value` - proves a link was made by this site. */
function linkSignature(purpose: string, value: string): string {
  return createHmac("sha256", getSecret()).update(`${purpose}:${value}`).digest("hex");
}

/** Signature for "yes, send me MANGOSTA WORLD emails" links. */
function newsletterConfirmToken(email: string): string {
  return linkSignature("newsletter-confirm:v1", normalize(email));
}

/**
 * Valid newsletter confirm link. Also accepts the older "join again" links
 * (newsletter-rejoin:v1) that may already be in someone's inbox.
 */
export function isValidNewsletterConfirmToken(email: string, token: string): boolean {
  if (!normalize(email) || typeof token !== "string") return false;
  return (
    signatureMatches(newsletterConfirmToken(email), token) ||
    signatureMatches(linkSignature("newsletter-rejoin:v1", normalize(email)), token)
  );
}

/** Page where the owner of an address confirms the newsletter subscription. */
export function newsletterConfirmPageUrl(email: string): string {
  const address = normalize(email);
  return `${getSiteUrl()}/newsletter/confirm?e=${encodeURIComponent(address)}&t=${newsletterConfirmToken(address)}`;
}

/** Signature for a "notify me" confirm link (one alert). */
function stockAlertToken(alertId: string, email: string): string {
  return linkSignature("stock-alert:v1", `${alertId}:${normalize(email)}`);
}

export function isValidStockAlertToken(alertId: string, email: string, token: string): boolean {
  if (!alertId || !normalize(email) || typeof token !== "string") return false;
  return signatureMatches(stockAlertToken(alertId, email), token);
}

/** Page where the owner of an address confirms a back-in-stock alert. */
export function stockAlertConfirmPageUrl(alertId: string, email: string): string {
  const address = normalize(email);
  return `${getSiteUrl()}/notify/confirm?id=${encodeURIComponent(alertId)}&e=${encodeURIComponent(address)}&t=${stockAlertToken(alertId, address)}`;
}

function linkQuery(email: string): string {
  const address = normalize(email);
  return `e=${encodeURIComponent(address)}&t=${unsubscribeToken(address)}`;
}

/** Page where the customer confirms unsubscribing (link in the email). */
export function unsubscribePageUrl(email: string): string {
  return `${getSiteUrl()}/unsubscribe?${linkQuery(email)}`;
}

/** One-click unsubscribe endpoint (List-Unsubscribe header, RFC 8058). */
export function oneClickUnsubscribeUrl(email: string): string {
  return `${getSiteUrl()}/api/unsubscribe?${linkQuery(email)}`;
}

/** Headers that give mail apps their own "Unsubscribe" button. */
export function marketingEmailHeaders(email: string): Record<string, string> {
  return {
    "List-Unsubscribe": `<${oneClickUnsubscribeUrl(email)}>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  };
}

/** Footer line with the unsubscribe link, for marketing emails. */
export function unsubscribeFooterHtml(email: string): string {
  return `<p style="font-size:11px;line-height:1.6;color:#7c776e;margin:18px 0 0;">You're getting this because you opted in to MANGOSTA emails. <a href="${escapeHtml(unsubscribePageUrl(email))}" style="color:#9d998f;text-decoration:underline;">Unsubscribe</a></p>`;
}

export function unsubscribeFooterText(email: string): string {
  return `Unsubscribe: ${unsubscribePageUrl(email)}`;
}

async function optOutsCollection() {
  const db = await getStoreDb();
  return db.collection<OptOutDocument>("emailOptOuts");
}

/** Emails (from the given list) that have unsubscribed from marketing. */
export async function getOptedOutEmails(emails: string[]): Promise<Set<string>> {
  const list = [...new Set(emails.map(normalize).filter(Boolean))];
  if (list.length === 0) return new Set();

  const collection = await optOutsCollection();
  const documents = await collection
    .find({ _id: { $in: list } }, { projection: { _id: 1 } })
    .toArray();

  return new Set(documents.map((document) => document._id));
}

/**
 * Stops ALL marketing emails to this address: records the opt-out,
 * unticks the account box and ends the newsletter subscription.
 */
export async function unsubscribeFromMarketing(
  email: string,
  source: OptOutDocument["source"] = "link"
): Promise<void> {
  const address = normalize(email);
  if (!address) return;

  const db = await getStoreDb();
  const now = new Date().toISOString();

  await Promise.all([
    db
      .collection<OptOutDocument>("emailOptOuts")
      .updateOne(
        { _id: address },
        { $set: { marketing: true, at: now, source } },
        { upsert: true }
      ),
    db
      .collection("users")
      .updateMany({ email: address }, { $set: { "preferences.marketingEmails": false } }),
    db
      .collection("newsletterSubscribers")
      .updateMany(
        { email: address, status: { $ne: "unsubscribed" } },
        { $set: { status: "unsubscribed", unsubscribedAt: now } }
      ),
  ]);
}

/** The customer opted in again (ticked the box / joined the newsletter). */
export async function clearMarketingOptOut(email: string): Promise<void> {
  const address = normalize(email);
  if (!address) return;
  const collection = await optOutsCollection();
  await collection.deleteOne({ _id: address });
}
