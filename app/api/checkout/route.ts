import { NextRequest, NextResponse } from "next/server";
import {
  calculateShipping,
  consumeCoupon,
  createOrder,
  getCheckoutSettings,
  validateCoupon,
} from "@/app/lib/dataStore";
import type { OrderLine } from "@/app/lib/dataStore";

interface CheckoutLineInput {
  lineId: string;
  productId: string;
  productName: string;
  slug: string;
  image: string;
  size: string;
  color: string;
  quantity: number;
  price: number;
}

export async function GET(req: NextRequest) {
  const settings = await getCheckoutSettings();
  const subtotalParam = req.nextUrl.searchParams.get("subtotal");
  const subtotal = Math.max(0, Number(subtotalParam) || 0);
  const shipping = calculateShipping(subtotal, settings);

  return NextResponse.json({
    settings,
    subtotal,
    shipping,
    total: subtotal + shipping,
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);

  if (!body || !Array.isArray(body.lines) || body.lines.length === 0) {
    return NextResponse.json({ error: "Cart is empty." }, { status: 400 });
  }

  const { email, firstName, lastName, mobile, address, city, postalCode } =
    body.customer || {};

  if (!email || !firstName || !lastName || !mobile || !address || !city || !postalCode) {
    return NextResponse.json(
      { error: "All contact and shipping fields are required." },
      { status: 400 }
    );
  }

  const lines: OrderLine[] = (body.lines as CheckoutLineInput[]).map((l) => ({
    lineId: l.lineId,
    productId: l.productId,
    productName: l.productName,
    slug: l.slug,
    image: l.image || "",
    size: l.size,
    color: l.color,
    quantity: Math.max(1, Number(l.quantity) || 1),
    price: Number(l.price) || 0,
  }));

  const subtotal = lines.reduce(
    (sum, line) => sum + line.price * line.quantity,
    0
  );

  const checkoutSettings = await getCheckoutSettings();
  const shipping = calculateShipping(subtotal, checkoutSettings);

  const requestedCouponCode =
    typeof body.couponCode === "string" ? body.couponCode.trim() : "";

  let couponCode = "";
  let discount = 0;

  if (requestedCouponCode) {
    const result = await validateCoupon(requestedCouponCode, subtotal).catch(
      (error) => ({ error })
    );

    if ("error" in result) {
      return NextResponse.json(
        {
          error:
            result.error instanceof Error
              ? result.error.message
              : "Invalid coupon code.",
        },
        { status: 400 }
      );
    }

    couponCode = result.coupon.code;
    discount = result.discount;
  }

  const total = Math.max(0, subtotal - discount) + shipping;

  const order = await createOrder({
    customer: {
      email: String(email).trim().toLowerCase(),
      firstName: String(firstName).trim(),
      lastName: String(lastName).trim(),
      mobile: String(mobile).trim(),
      address: String(address).trim(),
      city: String(city).trim(),
      postalCode: String(postalCode).trim(),
    },
    lines,
    subtotal,
    shipping,
    discount,
    couponCode: couponCode || undefined,
    total,
  });

  if (couponCode) {
    try {
      await consumeCoupon(couponCode);
    } catch {
      // Order already saved. Do not fail the order after persistence.
    }
  }

  return NextResponse.json(
    {
      order,
      discount,
      couponCode: couponCode || null,
    },
    { status: 201 }
  );
}
