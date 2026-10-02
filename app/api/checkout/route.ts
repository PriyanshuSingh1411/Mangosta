import { NextRequest, NextResponse } from "next/server";

import {
  calculateShipping,
  CouponUnavailableError,
  getCheckoutSettings,
  getProduct,
  InsufficientInventoryError,
  placeOrder,
  validateCoupon,
} from "@/app/lib/dataStore";

import type {
  NewOrderInput,
  Order,
  OrderLine,
} from "@/app/lib/dataStore";
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

      const quantity = Number(line.quantity);

      if (!Number.isInteger(quantity) || quantity < 1) {
        return NextResponse.json(
          {
            error: `Invalid quantity for "${product.name}".`,
          },
          { status: 400 }
        );
      }

      // Stock is NOT checked here. placeOrder() below checks and reserves
      // stock atomically, in the same transaction that saves the order.

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
        // Historical pricing snapshot for order records
        originalPrice: product.price,
        discountPercent: Number(product.discountPercent) || 0,
        compareAtPrice: product.compareAtPrice,
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

    const orderData: NewOrderInput = {
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

      if (error instanceof CouponUnavailableError) {
        return NextResponse.json(
          {
            error: error.message,
            couponCode,
          },
          { status: 409 }
        );
      }

      // Any other failure: the transaction was rolled back, so no order
      // exists, no stock was taken and no coupon use was recorded.
      // Handled by the outer catch (500).
      throw error;
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