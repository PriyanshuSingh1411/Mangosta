import { NextRequest, NextResponse } from "next/server";
import {
  getCoupons,
  validateCoupon,
} from "@/app/lib/dataStore";

/**
 * GET
 *
 * Returns coupons that are currently available on checkout.
 * Disabled, expired, not-yet-active, and exhausted coupons
 * are excluded.
 */
export async function GET() {
  try {
    const now = new Date();
    const coupons = await getCoupons();

    const activeCoupons = coupons
      .filter((coupon) => {
        if (!coupon.enabled) {
          return false;
        }

        if (coupon.startsAt) {
          const startsAt = new Date(
            coupon.startsAt
          );

          if (
            !Number.isNaN(startsAt.getTime()) &&
            now < startsAt
          ) {
            return false;
          }
        }

        if (coupon.expiresAt) {
          const expiresAt = new Date(
            coupon.expiresAt
          );

          if (
            !Number.isNaN(expiresAt.getTime()) &&
            now > expiresAt
          ) {
            return false;
          }
        }

        if (
          coupon.usageLimit > 0 &&
          coupon.usageCount >=
            coupon.usageLimit
        ) {
          return false;
        }

        if (
          !coupon.code ||
          !coupon.code.trim()
        ) {
          return false;
        }

        if (
          !Number.isFinite(
            coupon.discountValue
          ) ||
          coupon.discountValue <= 0
        ) {
          return false;
        }

        return true;
      })
      .map((coupon) => ({
        code: coupon.code,
        discountType:
          coupon.discountType,
        discountValue:
          coupon.discountValue,
        minOrderValue:
          coupon.minOrderValue,
        maxDiscount:
          coupon.maxDiscount,
        startsAt: coupon.startsAt,
        expiresAt: coupon.expiresAt,
      }));

    return NextResponse.json(
      {
        coupons: activeCoupons,
      },
      {
        status: 200,
        headers: {
          "Cache-Control":
            "no-store, max-age=0",
        },
      }
    );
  } catch (error) {
    console.error(
      "GET /api/checkout/coupon failed:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Unable to load available coupons.",
        coupons: [],
      },
      {
        status: 500,
      }
    );
  }
}

/**
 * POST
 *
 * Validates a specific coupon against the current
 * checkout subtotal and returns the calculated discount.
 */
export async function POST(
  request: NextRequest
) {
  try {
    const body = await request
      .json()
      .catch(() => null);

    if (!body || typeof body !== "object") {
      return NextResponse.json(
        {
          error: "Invalid request.",
        },
        {
          status: 400,
        }
      );
    }

    const rawCode = (
      body as {
        code?: unknown;
      }
    ).code;

    const rawSubtotal = (
      body as {
        subtotal?: unknown;
      }
    ).subtotal;

    const code =
      typeof rawCode === "string"
        ? rawCode
            .trim()
            .toUpperCase()
            .replace(/\s+/g, "")
        : "";

    const subtotal =
      typeof rawSubtotal === "number"
        ? rawSubtotal
        : Number(rawSubtotal);

    if (!code) {
      return NextResponse.json(
        {
          error:
            "Please enter a coupon code.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      !Number.isFinite(subtotal) ||
      subtotal < 0
    ) {
      return NextResponse.json(
        {
          error: "Invalid subtotal.",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * validateCoupon() performs all coupon rules:
     *
     * - coupon exists
     * - enabled
     * - start date
     * - expiry date
     * - usage limit
     * - minimum order value
     * - discount availability
     */
    const result =
      await validateCoupon(
        code,
        subtotal
      );

    const coupon = result.coupon;
    const discount = result.discount;

    const discountedSubtotal =
      Math.max(
        0,
        subtotal - discount
      );

    return NextResponse.json(
      {
        coupon: {
          id: coupon.id,
          code: coupon.code,
          discountType:
            coupon.discountType,
          discountValue:
            coupon.discountValue,
          minOrderValue:
            coupon.minOrderValue,
          maxDiscount:
            coupon.maxDiscount,
          startsAt:
            coupon.startsAt,
          expiresAt:
            coupon.expiresAt,
        },

        discount,

        subtotal,

        discountedSubtotal,
      },
      {
        status: 200,
        headers: {
          "Cache-Control":
            "no-store, max-age=0",
        },
      }
    );
  } catch (error) {
    console.error(
      "POST /api/checkout/coupon failed:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Invalid coupon code.",
      },
      {
        status: 400,
      }
    );
  }
}