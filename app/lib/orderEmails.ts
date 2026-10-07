import "server-only";

import {
  escapeHtml,
  isEmailConfigured,
  sendStoreEmail,
  storeEmailLayout,
  storeEmailProductRow,
} from "@/app/lib/auth/mail";
import { getSiteUrl } from "@/app/lib/db";
import { getStoreConfig } from "@/app/lib/storeConfig";
import { formatPrice } from "@/app/data/productTypes";
import { SUPPORT_WHATSAPP_DISPLAY } from "@/app/data/storeTypes";
import type { Order } from "@/app/lib/dataStore";

/*
 * Order emails:
 *   customer — placed, shipped (and tracking updates), delivered, cancelled
 *   shop     — every new order, and orders cancelled by the customer
 *              (sent to SMTP_USER, the address the store sends from)
 *
 * Every function here is safe to call without awaiting the result in a
 * request: it never throws, and does nothing when SMTP isn't set up.
 */

export type OrderEmailKind = "shipped" | "tracking" | "delivered" | "cancelled";

const MUTED = "color:#9d998f;";

function absolute(url: string, siteUrl: string): string {
  if (!url) return "";
  if (/^https?:\/\//i.test(url)) return url;
  return `${siteUrl}${url.startsWith("/") ? "" : "/"}${url}`;
}

function variantText(line: Order["lines"][number]): string {
  return [line.color, line.size, `Qty ${line.quantity}`, formatPrice(line.price * line.quantity)]
    .filter(Boolean)
    .join(" / ");
}

function itemsHtml(order: Order, siteUrl: string): string {
  return order.lines
    .map((line) =>
      storeEmailProductRow({
        image: absolute(line.image, siteUrl),
        name: line.productName,
        detail: variantText(line),
      })
    )
    .join("");
}

function totalsHtml(order: Order): string {
  const row = (label: string, value: string, strong = false) =>
    `<tr><td style="padding:4px 0;font-size:13px;${strong ? "color:#f2efe7;font-weight:700;" : MUTED}">${escapeHtml(label)}</td><td style="padding:4px 0;font-size:13px;text-align:right;${strong ? "color:#f2efe7;font-weight:700;" : "color:#bdb8ad;"}">${escapeHtml(value)}</td></tr>`;

  return `
    <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin-top:18px;border-top:1px solid #2a2926;padding-top:12px;">
      ${row("Subtotal", formatPrice(order.subtotal))}
      ${(order.discount ?? 0) > 0 ? row(`Discount${order.couponCode ? ` (${order.couponCode})` : ""}`, `-${formatPrice(order.discount ?? 0)}`) : ""}
      ${row("Shipping", order.shipping > 0 ? formatPrice(order.shipping) : "Free")}
      ${row("Total", formatPrice(order.total), true)}
      ${row("Payment", order.paymentMethod === "cod" ? "Cash on delivery" : "Online")}
    </table>
  `;
}

function addressHtml(order: Order): string {
  const c = order.customer;
  const lines = [
    `${c.firstName} ${c.lastName}`.trim(),
    c.address,
    [c.city, c.state, c.postalCode].filter(Boolean).join(", "),
    c.mobile,
  ].filter(Boolean);

  return `
    <p style="font-size:11px;letter-spacing:2px;${MUTED}margin:22px 0 6px;">DELIVERING TO</p>
    <p style="font-size:13px;line-height:1.6;color:#bdb8ad;margin:0;">${lines.map(escapeHtml).join("<br />")}</p>
  `;
}

function helpHtml(): string {
  return `<p style="font-size:12px;line-height:1.6;${MUTED}margin:22px 0 0;">Questions about your order? WhatsApp us on ${escapeHtml(SUPPORT_WHATSAPP_DISPLAY)} or just reply to this email.</p>`;
}

function itemsText(order: Order): string {
  return order.lines.map((line) => `- ${line.productName} (${variantText(line)})`).join("\n");
}

async function send(to: string, subject: string, html: string, text: string, label: string) {
  if (!to) return;
  try {
    await sendStoreEmail({ to, subject, html, text });
  } catch (error) {
    console.error(`[ORDER EMAIL] Could not send "${label}" to ${to}:`, error);
  }
}

/** Confirmation to the customer + "new order" alert to the shop. */
export async function sendOrderPlacedEmails(order: Order): Promise<void> {
  if (!isEmailConfigured()) return;
  const siteUrl = getSiteUrl();
  const orderUrl = `${siteUrl}/orders/${encodeURIComponent(order.id)}`;
  const name = order.customer.firstName || "there";

  await send(
    order.customer.email,
    `Order confirmed — ${order.id}`,
    storeEmailLayout({
      eyebrow: "MANGOSTA / ORDER CONFIRMED",
      heading: "THANK YOU FOR YOUR ORDER",
      intro: `Hi ${name},\nWe've received your order ${order.id} and we're getting it ready. We'll email you again as soon as it ships.`,
      contentHtml: itemsHtml(order, siteUrl) + totalsHtml(order) + addressHtml(order) + helpHtml(),
      buttonText: "VIEW YOUR ORDER",
      buttonUrl: orderUrl,
    }),
    `Hi ${name},\n\nWe've received your order ${order.id}.\n\n${itemsText(order)}\n\nTotal: ${formatPrice(order.total)}\n\nView your order: ${orderUrl}\n\nQuestions? WhatsApp us on ${SUPPORT_WHATSAPP_DISPLAY}.`,
    "order placed"
  );

  const c = order.customer;
  await send(
    process.env.SMTP_USER ?? "",
    `New order ${order.id} — ${formatPrice(order.total)}`,
    storeEmailLayout({
      eyebrow: "MANGOSTA / NEW ORDER",
      heading: `NEW ORDER · ${formatPrice(order.total)}`,
      intro: `${`${c.firstName} ${c.lastName}`.trim()} · ${c.email}${c.mobile ? ` · ${c.mobile}` : ""}\n${order.paymentMethod === "cod" ? "Cash on delivery" : "Online payment"} · ${order.lines.reduce((sum, line) => sum + line.quantity, 0)} item(s)`,
      contentHtml: itemsHtml(order, siteUrl) + totalsHtml(order) + addressHtml(order),
      buttonText: "OPEN IN ADMIN",
      buttonUrl: `${siteUrl}/admin/orders#${encodeURIComponent(order.id)}`,
    }),
    `New order ${order.id} from ${c.firstName} ${c.lastName} (${c.email}).\n\n${itemsText(order)}\n\nTotal: ${formatPrice(order.total)}\n\n${siteUrl}/admin/orders#${order.id}`,
    "new order alert"
  );
}

/** Shipped / tracking updated / delivered / cancelled email to the customer. */
export async function sendOrderStatusEmail(order: Order, kind: OrderEmailKind): Promise<void> {
  if (!isEmailConfigured()) return;
  const siteUrl = getSiteUrl();
  const orderUrl = `${siteUrl}/orders/${encodeURIComponent(order.id)}`;
  const name = order.customer.firstName || "there";
  const shipment = order.shipment;
  const courierLine = shipment && (shipment.courier || shipment.trackingNumber)
    ? `${shipment.courier || "Courier"}${shipment.trackingNumber ? ` · Tracking number ${shipment.trackingNumber}` : ""}`
    : "";

  if (kind === "shipped" || kind === "tracking") {
    const tracking = shipment?.trackingUrl && /^https?:\/\//i.test(shipment.trackingUrl) ? shipment.trackingUrl : "";
    await send(
      order.customer.email,
      kind === "shipped" ? `Your order ${order.id} has shipped` : `Tracking update for order ${order.id}`,
      storeEmailLayout({
        eyebrow: "MANGOSTA / SHIPPED",
        heading: kind === "shipped" ? "YOUR ORDER IS ON ITS WAY" : "TRACKING UPDATED",
        intro: `Hi ${name},\n${kind === "shipped" ? `Good news — order ${order.id} is on its way to you.` : `Here are the latest tracking details for order ${order.id}.`}${courierLine ? `\n${courierLine}` : ""}`,
        contentHtml: itemsHtml(order, siteUrl) + addressHtml(order) + helpHtml(),
        buttonText: tracking ? "TRACK PACKAGE" : "VIEW YOUR ORDER",
        buttonUrl: tracking || orderUrl,
      }),
      `Hi ${name},\n\nOrder ${order.id} has shipped.${courierLine ? `\n${courierLine}` : ""}\n${tracking ? `Track it: ${tracking}\n` : ""}\nYour order: ${orderUrl}`,
      kind
    );
    return;
  }

  if (kind === "delivered") {
    let returnsLine = "";
    try {
      const policy = await getStoreConfig("returnsPolicy");
      if (policy.enabled && (policy.allowReturns || policy.allowExchanges)) {
        returnsLine = `\n\nNeed a different size? You can request ${policy.allowExchanges ? "an exchange" : "a return"} from your order page within ${policy.windowDays} days.`;
      }
    } catch {
      // returns note is optional
    }

    await send(
      order.customer.email,
      `Delivered — how do you like your order ${order.id}?`,
      storeEmailLayout({
        eyebrow: "MANGOSTA / DELIVERED",
        heading: "YOUR ORDER HAS ARRIVED",
        intro: `Hi ${name},\nOrder ${order.id} has been delivered. We hope you love it — a quick review helps other shoppers pick the right fit.${returnsLine}`,
        contentHtml: itemsHtml(order, siteUrl) + helpHtml(),
        buttonText: "REVIEW YOUR ITEMS",
        buttonUrl: `${orderUrl}#review`,
      }),
      `Hi ${name},\n\nOrder ${order.id} has been delivered. We hope you love it!\n\nReview your items: ${orderUrl}#review${returnsLine}`,
      "delivered"
    );
    return;
  }

  // cancelled
  const byCustomer = order.cancelledBy === "customer";
  const refundLine =
    order.paymentStatus === "paid"
      ? "\nYour payment will be refunded to your original payment method within 5–7 working days."
      : order.paymentMethod === "cod"
        ? "\nNothing was charged, as this was a cash on delivery order."
        : "";

  await send(
    order.customer.email,
    `Order ${order.id} has been cancelled`,
    storeEmailLayout({
      eyebrow: "MANGOSTA / ORDER CANCELLED",
      heading: "ORDER CANCELLED",
      intro: `Hi ${name},\n${byCustomer ? `As you asked, we've cancelled order ${order.id}.` : `Your order ${order.id} has been cancelled.`}${refundLine}`,
      contentHtml: itemsHtml(order, siteUrl) + helpHtml(),
      buttonText: "CONTINUE SHOPPING",
      buttonUrl: `${siteUrl}/shop`,
    }),
    `Hi ${name},\n\nOrder ${order.id} has been cancelled.${refundLine}\n\n${itemsText(order)}\n\nShop again: ${siteUrl}/shop`,
    "cancelled"
  );
}

/** Tells the shop that a customer cancelled their order. */
export async function sendShopCancelAlert(order: Order): Promise<void> {
  if (!isEmailConfigured()) return;
  const siteUrl = getSiteUrl();
  const c = order.customer;

  await send(
    process.env.SMTP_USER ?? "",
    `Order ${order.id} cancelled by customer`,
    storeEmailLayout({
      eyebrow: "MANGOSTA / ORDER CANCELLED",
      heading: "CUSTOMER CANCELLED AN ORDER",
      intro: `${`${c.firstName} ${c.lastName}`.trim()} (${c.email}) cancelled order ${order.id} (${formatPrice(order.total)}).\nReason: ${order.cancelReason || "not given"}\nThe stock has been put back automatically — don't ship this order.`,
      contentHtml: itemsHtml(order, siteUrl),
      buttonText: "OPEN IN ADMIN",
      buttonUrl: `${siteUrl}/admin/orders#${encodeURIComponent(order.id)}`,
    }),
    `${c.firstName} ${c.lastName} (${c.email}) cancelled order ${order.id}.\nReason: ${order.cancelReason || "not given"}\nStock was put back automatically. Don't ship this order.`,
    "shop cancel alert"
  );
}

/** Which email (if any) a status change from the admin should send. */
export function emailForStatusChange(before: Order, after: Order): OrderEmailKind | null {
  if (after.status === before.status) {
    if (
      after.status === "shipped" &&
      (after.shipment?.trackingNumber || after.shipment?.trackingUrl) &&
      (after.shipment?.trackingNumber !== before.shipment?.trackingNumber ||
        after.shipment?.trackingUrl !== before.shipment?.trackingUrl)
    ) {
      return "tracking";
    }
    return null;
  }
  if (after.status === "shipped" && before.status === "pending") return "shipped";
  if (after.status === "delivered") return "delivered";
  if (after.status === "cancelled") return "cancelled";
  return null;
}
