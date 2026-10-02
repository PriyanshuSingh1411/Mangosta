import { NextRequest, NextResponse } from "next/server";

import {
  calculateShipping,
  consumeCoupon,
  createOrder,
  getCheckoutSettings,
  getProduct,
  validateCoupon,
} from "@/app/lib/dataStore";

import type { OrderLine } from "@/app/lib/dataStore";
import { getProductSalePrice } from "@/app/data/productTypes";

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
/* Used by checkout page to calculate shipping                                */
/* -------------------------------------------------------------------------- */

export async function GET(req: NextRequest) {
  try {
    const settings = await getCheckoutSettings();

    const subtotalParam = req.nextUrl.searchParams.get("subtotal");

    const subtotal = Math.max(
      0,
      Number(subtotalParam) || 0
    );

    const shipping = calculateShipping(
      subtotal,
      settings
    );

    return NextResponse.json({
      settings,
      subtotal,
      shipping,
      total: subtotal + shipping,
    });
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

    const {
      email,
      firstName,
      lastName,
      mobile,
      address,
      city,
      state,
      postalCode,
    } = body.customer || {};

    if (
      !email ||
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
    /* Prepare order lines                                                    */
    /* ---------------------------------------------------------------------- */

    const inputLines = body.lines as CheckoutLineInput[];
    const lines: OrderLine[] = [];

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

      const quantity = Math.max(
        1,
        Number(line.quantity) || 1
      );

      if (product.inventory < quantity) {
        return NextResponse.json(
          {
            error: `${product.name} does not have enough inventory.`,
          },
          { status: 400 }
        );
      }

      lines.push({
        lineId: String(line.lineId),
        productId: product.id,
        productName: product.name,
        slug: product.slug,
        image: product.images?.[0] || "",
        size: String(line.size || ""),
        color: String(line.color || ""),
        quantity,
        // Never trust the price supplied by the browser.
        price: getProductSalePrice(product),
      });
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
      const result =
        await validateCoupon(
          requestedCouponCode,
          subtotal
        ).catch((error) => ({
          error,
        }));

      if ("error" in result) {
        return NextResponse.json(
          {
            error:
              result.error instanceof Error
                ? result.error.message
                : "Invalid coupon code.",
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
    /* Create order                                                           */
    /* ---------------------------------------------------------------------- */

    const order = await createOrder({
      customer: {
        email: String(email)
          .trim()
          .toLowerCase(),

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
    });

    /* ---------------------------------------------------------------------- */
    /* Consume coupon after successful order                                  */
    /* ---------------------------------------------------------------------- */

    if (couponCode) {
      try {
        await consumeCoupon(
          couponCode
        );
      } catch (couponError) {
        console.error(
          "Coupon consumption failed after order creation:",
          couponError
        );

        /*
         * The order has already been created,
         * so we don't fail the customer's order.
         */
      }
    }

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

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to place order.",
      },
      {
        status: 500,
      }
    );
  }
}