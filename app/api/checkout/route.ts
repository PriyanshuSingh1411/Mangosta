import { NextRequest, NextResponse, after } from "next/server";

import {
  calculateShipping,
  CouponUnavailableError,
  AccountClosedError,
  getCheckoutSettings,
  getProduct,
  InsufficientInventoryError,
  OrderInProgressError,
  placeOrder,
  UnpaidOrderLimitError,
  validateCoupon,
  validateCheckoutReward,
  CouponError,
} from "@/app/lib/dataStore";

import type {
  NewOrderInput,
  Order,
  OrderLine,
} from "@/app/lib/dataStore";
import {
  getLineImage,
  getProductSalePrice,
  getProductSizes,
  MAX_PER_SIZE_PER_ORDER,
} from "@/app/data/productTypes";
import { getStoreConfig } from "@/app/lib/storeConfig";
import { checkPincode } from "@/app/data/storeTypes";
import { sendOrderPlacedEmails } from "@/app/lib/orderEmails";
import { getCurrentUser, type AuthUser } from "@/app/lib/auth/session";
import {
  getEngagementSessionId,
  trackServerEngagement,
} from "@/app/lib/userEngagementServer";

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

type PaymentMethod = "cod" | "online" | "card";

function isValidPaymentMethod(value: unknown): value is PaymentMethod {
  return value === "cod" || value === "online" || value === "card";
}

/* -------------------------------------------------------------------------- */
/* GET /api/checkout                                                          */
/* Returns checkout/shipping settings only.                                   */
/*                                                                            */
/* The checkout page uses these settings to display a shipping estimate.     */
/* Nothing sent by the browser (e.g. a ?subtotal= value) is read or trusted  */
/* here. The amount actually charged is recalculated in POST from database   */
/* prices.                                                                    */
/* -------------------------------------------------------------------------- */

export async function GET() {
  try {
    const settings = await getCheckoutSettings();

    return NextResponse.json({ settings });
  } catch (error) {
    console.error("Checkout GET error:", error);

    return NextResponse.json(
      {
        error: "Unable to calculate checkout details.",
      },
      {
        status: 500,
      }
    );
  }
}

/* -------------------------------------------------------------------------- */
/* POST /api/checkout                                                         */
/* Creates the order                                                          */
/* -------------------------------------------------------------------------- */

export async function POST(req: NextRequest) {
  try {
    /* ---------------------------------------------------------------------- */
    /* Signed-in customer only                                                */
    /*                                                                        */
    /* Every order belongs to an account. The order email is ALWAYS the       */
    /* account's own (verified by OTP at sign-in) - never the email typed in  */
    /* the form - so nobody can place orders in someone else's name.          */
    /* ---------------------------------------------------------------------- */

    let signedInUser: AuthUser | null;

    try {
      signedInUser = await getCurrentUser();
    } catch (error) {
      console.error("Checkout POST: could not check the sign-in.", error);

      return NextResponse.json(
        {
          error:
            "We couldn't check your sign-in right now. Please try again in a moment.",
        },
        {
          status: 503,
        }
      );
    }

    if (!signedInUser?.id || !signedInUser.email) {
      return NextResponse.json(
        {
          error: "Please sign in to place your order.",
        },
        {
          status: 401,
        }
      );
    }

    const accountEmail = String(signedInUser.email)
      .trim()
      .toLowerCase();

    const body = await req.json().catch(() => null);

    /* ---------------------------------------------------------------------- */
    /* Validate request                                                       */
    /* ---------------------------------------------------------------------- */

    if (
      !body ||
      !Array.isArray(body.lines) ||
      body.lines.length === 0
    ) {
      return NextResponse.json(
        {
          error: "Cart is empty.",
        },
        {
          status: 400,
        }
      );
    }

    /* ---------------------------------------------------------------------- */
    /* Customer                                                               */
    /* ---------------------------------------------------------------------- */

    // customer.email from the form is ignored on purpose (see above).
    const {
      firstName,
      lastName,
      mobile,
      address,
      city,
      state,
      postalCode,
    } = body.customer || {};

    if (
      !firstName ||
      !lastName ||
      !mobile ||
      !address ||
      !city ||
      !state ||
      !postalCode
    ) {
      return NextResponse.json(
        {
          error:
            "All contact and shipping fields are required.",
        },
        {
          status: 400,
        }
      );
    }

    /* ---------------------------------------------------------------------- */
    /* Payment method                                                         */
    /* ---------------------------------------------------------------------- */

    const paymentMethod = body.paymentMethod;

    if (!isValidPaymentMethod(paymentMethod)) {
      return NextResponse.json(
        {
          error: "Please select a valid payment method.",
        },
        {
          status: 400,
        }
      );
    }

    /* ---------------------------------------------------------------------- */
    /* Delivery: pincode serviceability + cash on delivery (Admin → Delivery) */
    /* ---------------------------------------------------------------------- */

    const deliveryConfig = await getStoreConfig("delivery");

    if (deliveryConfig.enabled) {
      const delivery = checkPincode(deliveryConfig, String(postalCode));

      if (!delivery.valid || !delivery.serviceable) {
        return NextResponse.json(
          {
            error: delivery.valid
              ? `Sorry, we don't deliver to PIN code ${String(postalCode)} yet.`
              : "Please enter a valid 6-digit PIN code.",
          },
          { status: 400 }
        );
      }

      if (paymentMethod === "cod" && !delivery.cod) {
        return NextResponse.json(
          {
            error: `Cash on delivery isn't available for PIN code ${String(postalCode)}. Please choose another payment method.`,
          },
          { status: 400 }
        );
      }
    }

    /* ---------------------------------------------------------------------- */
    /* Prepare order lines                                                    */
    /* ---------------------------------------------------------------------- */

    const inputLines = body.lines as CheckoutLineInput[];
    const lines: OrderLine[] = [];
    // Every order line gets its own id (returns, reviews and refunds refer
    // to lines by id), even if the browser sends duplicates or none.
    const usedLineIds = new Set<string>();

    for (const line of inputLines) {
      const product = await getProduct(String(line.productId));

      if (!product) {
        return NextResponse.json(
          {
            error: `Product "${String(line.productName)}" is no longer available.`,
          },
          { status: 400 }
        );
      }

      const quantity = Number(line.quantity);

      if (!Number.isInteger(quantity) || quantity < 1) {
        return NextResponse.json(
          {
            error: `Invalid quantity for "${product.name}".`,
          },
          { status: 400 }
        );
      }

      const size = String(line.size || "");
      const color = String(line.color || "");

      // The size / colour must exist on the product (stock is kept per
      // size & colour for products that track it).
      const colorOk =
        product.colors.length === 0
          ? true
          : product.colors.some((option) => option.name === color);

      if (!colorOk || !getProductSizes(product).includes(size)) {
        return NextResponse.json(
          {
            error: `"${product.name}" in ${[color, size].filter(Boolean).join(" / ") || "this option"} is no longer available. Please remove it from your bag and add it again.`,
          },
          { status: 400 }
        );
      }

      // Stock is NOT checked here. placeOrder() below checks and reserves
      // stock atomically, in the same transaction that saves the order.

      const requestedLineId = String(line.lineId ?? "").trim().slice(0, 120) || product.id;
      let lineId = requestedLineId;
      for (let n = 2; usedLineIds.has(lineId); n++) {
        lineId = `${requestedLineId}-${n}`;
      }
      usedLineIds.add(lineId);

      lines.push({
        lineId,
        productId: product.id,
        productName: product.name,
        slug: product.slug,
        image: getLineImage(product, color),
        size,
        color,
        quantity,
        // Never trust the price supplied by the browser.
        price: getProductSalePrice(product),
        // Historical pricing snapshot for order records
        originalPrice: product.price,
        discountPercent: Number(product.discountPercent) || 0,
        compareAtPrice: product.compareAtPrice,
      });
    }

    // At most MAX_PER_SIZE_PER_ORDER of one size & colour per order (the
    // bag allows the same). This also means a stock error can never reveal
    // more than the storefront shows.
    const unitsPerVariant = new Map<string, { name: string; units: number }>();
    for (const line of lines) {
      const key = `${line.productId}|${line.color}|${line.size}`;
      const entry = unitsPerVariant.get(key) ?? { name: line.productName, units: 0 };
      entry.units += line.quantity;
      unitsPerVariant.set(key, entry);
    }
    const overLimit = [...unitsPerVariant.values()].find((entry) => entry.units > MAX_PER_SIZE_PER_ORDER);
    if (overLimit) {
      return NextResponse.json(
        {
          error: `You can buy up to ${MAX_PER_SIZE_PER_ORDER} of each size of "${overLimit.name}" per order. Please lower the quantity in your bag.`,
        },
        { status: 400 }
      );
    }

    /* ---------------------------------------------------------------------- */
    /* Calculate subtotal                                                     */
    /* ---------------------------------------------------------------------- */

    const subtotal = lines.reduce(
      (sum, line) =>
        sum + line.price * line.quantity,
      0
    );

    /* ---------------------------------------------------------------------- */
    /* Calculate shipping                                                     */
    /* ---------------------------------------------------------------------- */

    const checkoutSettings =
      await getCheckoutSettings();

    const shipping = calculateShipping(
      subtotal,
      checkoutSettings
    );

    /* ---------------------------------------------------------------------- */
    /* Coupon                                                                 */
    /* ---------------------------------------------------------------------- */

    const requestedCouponCode =
      typeof body.couponCode === "string"
        ? body.couponCode.trim()
        : "";

    let couponCode = "";
    let discount = 0;

    if (requestedCouponCode) {
      const rewardResult = await validateCheckoutReward(requestedCouponCode, subtotal).catch(() => null);

      if (rewardResult) {
        couponCode = rewardResult.reward.couponCode;
        discount = Math.min(subtotal, Math.max(0, Number(rewardResult.discount) || 0));
      } else {
        const result =
          await validateCoupon(
            requestedCouponCode,
            subtotal,
            { userId: signedInUser.id, email: accountEmail }
          ).catch((error) => ({
            error,
          }));

        if ("error" in result) {
          if (!(result.error instanceof CouponError)) {
            console.error("Checkout coupon check failed:", result.error);
            return NextResponse.json(
              { error: "We couldn't check your coupon right now. Please try again in a moment." },
              { status: 500 }
            );
          }

          return NextResponse.json(
            {
              error: result.error.message,
            },
            {
              status: 400,
            }
          );
        }

        couponCode = result.coupon.code;

        discount = Math.min(
          subtotal,
          Math.max(
            0,
            Number(result.discount) || 0
          )
        );
      }
    }

    /* ---------------------------------------------------------------------- */
    /* Final total                                                            */
    /* ---------------------------------------------------------------------- */

    const total =
      Math.max(
        0,
        subtotal - discount
      ) + shipping;

    /* ---------------------------------------------------------------------- */
    /* Payment status                                                         */
    /*                                                                      */
    /* COD doesn't require an online payment.                                */
    /* Online/Card should remain pending until a real payment gateway        */
    /* confirms the payment.                                                 */
    /* ---------------------------------------------------------------------- */

    const paymentStatus =
      paymentMethod === "cod"
        ? "pending"
        : "pending";

    /* ---------------------------------------------------------------------- */
    /* Reserve stock + use coupon + create order (one all-or-nothing step)    */
    /*                                                                        */
    /* placeOrder() runs in a MongoDB transaction:                            */
    /*   - decrements stock for every product (conditional, atomic)           */
    /*   - any product short → rollback, no order → HTTP 409 below            */
    /*   - coupon: re-checked and one use recorded (conditional, atomic);     */
    /*     limit reached / disabled / changed → rollback → HTTP 409 below     */
    /*   - saves the order; if that fails → rollback, nothing changed → 500   */
    /* Stock and coupon usage change exactly once, only when the order exists.*/
    /* ---------------------------------------------------------------------- */

    /* ---------------------------------------------------------------------- */
    /* Analytics link: the browser engagement session, so admin User          */
    /* analytics can attribute the order. Never blocks checkout.              */
    /* ---------------------------------------------------------------------- */

    const engagementSessionId = await getEngagementSessionId().catch(
      () => ""
    );

    const orderData: NewOrderInput = {
      userId: signedInUser.id,
      ...(engagementSessionId ? { engagementSessionId } : {}),

      customer: {
        email: accountEmail,

        firstName: String(firstName)
          .trim(),

        lastName: String(lastName)
          .trim(),

        mobile: String(mobile)
          .trim(),

        address: String(address)
          .trim(),

        city: String(city)
          .trim(),

        state: String(state)
          .trim(),

        postalCode: String(postalCode)
          .trim(),
      },

      lines,

      subtotal,

      shipping,

      discount,

      couponCode:
        couponCode || undefined,

      total,

      paymentMethod,

      paymentStatus,
    };

    let order: Order;

    try {
      order = await placeOrder(orderData);
    } catch (error) {
      if (error instanceof InsufficientInventoryError) {
        return NextResponse.json(
          {
            error: error.message,
            unavailableProducts: error.products,
          },
          { status: 409 }
        );
      }

      if (error instanceof AccountClosedError) {
        return NextResponse.json({ error: error.message }, { status: 401 });
      }

      if (error instanceof CouponUnavailableError) {
        return NextResponse.json(
          {
            error: error.message,
            couponCode,
          },
          { status: 409 }
        );
      }

      // Already MAX_OPEN_UNPAID_ORDERS unpaid orders waiting to ship.
      if (error instanceof UnpaidOrderLimitError) {
        return NextResponse.json(
          {
            error: error.message,
            limit: error.limit,
          },
          { status: 429 }
        );
      }

      // Only without MongoDB transactions: another order of this account
      // was still being placed. Nothing changed; the customer can retry.
      if (error instanceof OrderInProgressError) {
        return NextResponse.json(
          {
            error: error.message,
          },
          { status: 409 }
        );
      }

      // Any other failure: the transaction was rolled back, so no order
      // exists, no stock was taken and no coupon use was recorded.
      // Handled by the outer catch (500).
      throw error;
    }

    // Purchase event recorded by the server the moment the order exists
    // (the browser no longer sends it, so it can't be lost or doubled).
    await trackServerEngagement({
      event: "purchase",
      userId: signedInUser.id,
      path: "/checkout/payment",
      metadata: {
        orderId: order.id,
        paymentMethod,
        itemCount: order.lines.reduce(
          (count, line) => count + line.quantity,
          0
        ),
        uniqueProducts: order.lines.length,
        subtotal: order.subtotal,
        discount: order.discount ?? 0,
        shipping: order.shipping,
        total: order.total,
        couponCode: order.couponCode || "",
      },
    });

    // Confirmation to the customer + alert to the shop, sent after the
    // response so a slow mail server never delays checkout.
    after(() => sendOrderPlacedEmails(order));

    /* ---------------------------------------------------------------------- */
    /* Response                                                               */
    /* ---------------------------------------------------------------------- */

    return NextResponse.json(
      {
        success: true,

        order,

        orderId: order.id,

        paymentMethod,

        paymentStatus,

        discount,

        couponCode:
          couponCode || null,
      },
      {
        status: 201,
      }
    );
  } catch (error) {
    console.error(
      "Checkout POST error:",
      error
    );

    // The details are in the server log; the customer gets a plain message.
    return NextResponse.json(
      {
        error: "We couldn't place your order right now. Please try again in a moment.",
      },
      {
        status: 500,
      }
    );
  }
}