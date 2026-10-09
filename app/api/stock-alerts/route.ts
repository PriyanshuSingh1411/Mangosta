import { NextRequest, NextResponse } from "next/server";
import { getProduct } from "@/app/lib/dataStore";
import {
  createStockAlert,
  isValidEmail,
  sendStockAlertConfirmEmail,
} from "@/app/lib/stockAlerts";
import { getProductSizes, isVariantAvailable } from "@/app/data/productTypes";
import { getCurrentUser } from "@/app/lib/auth/session";
import { consumeRateLimits, describeWait, getClientIp } from "@/app/lib/rateLimit";

const HOUR_MS = 60 * 60 * 1000;

/**
 * POST /api/stock-alerts { productId, color, size, email }
 * "Notify me when back in stock" — works for guests too.
 *
 * A signed-in customer using their own account email is saved at once.
 * Any other email gets a confirm link first; until it's confirmed the
 * alert sends nothing (so nobody can sign strangers up).
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const productId = String(body?.productId ?? "");
  const color = String(body?.color ?? "").slice(0, 60);
  const size = String(body?.size ?? "").slice(0, 20);
  const email = String(body?.email ?? "").trim().toLowerCase().slice(0, 200);

  if (!isValidEmail(email)) {
    return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
  }

  // Each request can send an email: limit per network and per address.
  const rate = await consumeRateLimits([
    // Per network: generous, as mobile networks share one IP among many shoppers.
    { key: `stock-alert:ip:${getClientIp(req)}`, limit: 30, windowMs: HOUR_MS },
    { key: `stock-alert:email:${email}`, limit: 5, windowMs: HOUR_MS },
  ]);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: `Too many requests. Please try again in ${describeWait(rate.retryAfterSeconds)}.` },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } }
    );
  }

  const product = await getProduct(productId);
  if (!product) {
    return NextResponse.json({ error: "Product not found." }, { status: 404 });
  }

  const colorOk = product.colors.length === 0 ? color === "" : product.colors.some((c) => c.name === color);
  if (!colorOk || !getProductSizes(product).includes(size)) {
    return NextResponse.json({ error: "Please choose a colour and size." }, { status: 400 });
  }

  if (isVariantAvailable(product, color, size)) {
    return NextResponse.json({ error: "Good news — this size is in stock right now." }, { status: 409 });
  }

  const user = await getCurrentUser().catch(() => null);
  const ownVerifiedEmail = Boolean(user?.email && user.email.trim().toLowerCase() === email);

  const result = await createStockAlert({ productId, color, size, email, confirmed: ownVerifiedEmail });

  // Someone else's email (guest, or not their account email): the reply is
  // the same whether or not that address already has a confirmed alert,
  // so the form doesn't reveal it. The confirm email goes out only when needed.
  if (!ownVerifiedEmail) {
    if (result.needsConfirmation) {
      try {
        await sendStockAlertConfirmEmail({
          alertId: result.alertId,
          email,
          productName: product.name,
          detail: [color, size].filter(Boolean).join(" / "),
        });
      } catch (error) {
        console.error("[stock alerts] Could not send the confirm email:", error);
        return NextResponse.json(
          { error: "Couldn't send the confirmation email right now. Please try again later." },
          { status: 503 }
        );
      }
    }
    return NextResponse.json({ ok: true, confirmationSent: true });
  }

  // Signed in with their own (verified) email: saved and active at once.
  return NextResponse.json({ ok: true, alreadyWaiting: result.alreadyWaiting });
}
