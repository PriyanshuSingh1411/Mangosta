import { NextRequest, NextResponse } from "next/server";
import {
  getCoupons,
  saveCoupons,
  type Coupon,
  type CouponDiscountType,
} from "@/app/lib/dataStore";
import { isAuthenticated } from "@/app/lib/adminAuth";

function normalizeNumber(
  value: unknown,
  fallback = 0
): number {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return fallback;
  }

  return number;
}

function normalizeInteger(
  value: unknown,
  fallback = 0
): number {
  return Math.max(
    0,
    Math.floor(normalizeNumber(value, fallback))
  );
}

function normalizeCode(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
}

/**
 * Convert an incoming date into the format used by the
 * checkout/admin application.
 *
 * datetime-local values arrive as:
 * YYYY-MM-DDTHH:mm
 *
 * We intentionally preserve this local value instead of
 * converting it through toISOString(), because doing so
 * can shift the date/time because of timezone conversion.
 */
function normalizeDateTime(
  value: unknown
): string {
  if (!value || typeof value !== "string") {
    return "";
  }

  const trimmed = value.trim();

  if (!trimmed) {
    return "";
  }

  // datetime-local format.
  const localMatch = trimmed.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/
  );

  if (localMatch) {
    return trimmed;
  }

  // Support strings that include seconds but no timezone.
  const secondsMatch = trimmed.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})$/
  );

  if (secondsMatch) {
    return `${secondsMatch[1]}-${secondsMatch[2]}-${secondsMatch[3]}T${secondsMatch[4]}:${secondsMatch[5]}`;
  }

  // Existing ISO/date values.
  const parsed = new Date(trimmed);

  if (Number.isNaN(parsed.getTime())) {
    return "";
  }

  const pad = (number: number) =>
    String(number).padStart(2, "0");

  return `${parsed.getFullYear()}-${pad(
    parsed.getMonth() + 1
  )}-${pad(parsed.getDate())}T${pad(
    parsed.getHours()
  )}:${pad(parsed.getMinutes())}`;
}

function createCouponId(): string {
  return `coupon-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 10)}`;
}

function normalizeCoupon(
  input: Partial<Coupon>,
  existing?: Coupon
): Coupon {
  const discountType: CouponDiscountType =
    input.discountType === "fixed"
      ? "fixed"
      : "percentage";

  const discountValue = Math.max(
    0,
    normalizeNumber(input.discountValue, 0)
  );

  const minOrderValue = Math.max(
    0,
    normalizeNumber(input.minOrderValue, 0)
  );

  const maxDiscount =
    discountType === "percentage"
      ? Math.max(
          0,
          normalizeNumber(input.maxDiscount, 0)
        )
      : 0;

  const usageLimit = normalizeInteger(
    input.usageLimit,
    0
  );

  const usageCount = Math.min(
    usageLimit === 0
      ? normalizeInteger(
          input.usageCount,
          existing?.usageCount ?? 0
        )
      : normalizeInteger(
          input.usageCount,
          existing?.usageCount ?? 0
        ),
    usageLimit === 0
      ? Number.MAX_SAFE_INTEGER
      : usageLimit
  );

  return {
    id:
      typeof input.id === "string" &&
      input.id.trim()
        ? input.id.trim()
        : existing?.id || createCouponId(),

    code: normalizeCode(input.code),

    enabled:
      typeof input.enabled === "boolean"
        ? input.enabled
        : existing?.enabled ?? true,

    discountType,

    discountValue,

    minOrderValue,

    maxDiscount,

    startsAt: normalizeDateTime(
      input.startsAt
    ),

    expiresAt: normalizeDateTime(
      input.expiresAt
    ),

    usageLimit,

    usageCount,

  };
}

function getTodayDateString(): string {
  const now = new Date();

  const pad = (number: number) =>
    String(number).padStart(2, "0");

  return `${now.getFullYear()}-${pad(
    now.getMonth() + 1
  )}-${pad(now.getDate())}`;
}

function validateCouponData(
  coupons: Coupon[]
): string | null {
  const today = getTodayDateString();

  const codes = new Set<string>();

  for (const coupon of coupons) {
    if (!coupon.code) {
      return "Coupon code cannot be empty.";
    }

    if (codes.has(coupon.code)) {
      return `Duplicate coupon code: ${coupon.code}`;
    }

    codes.add(coupon.code);

    if (
      coupon.discountType !== "percentage" &&
      coupon.discountType !== "fixed"
    ) {
      return `Invalid discount type for coupon ${coupon.code}.`;
    }

    if (
      !Number.isFinite(coupon.discountValue) ||
      coupon.discountValue <= 0
    ) {
      return `Discount value for ${coupon.code} must be greater than 0.`;
    }

    if (
      coupon.discountType === "percentage" &&
      coupon.discountValue > 100
    ) {
      return `Percentage discount for ${coupon.code} cannot be greater than 100.`;
    }

    if (
      !Number.isFinite(coupon.minOrderValue) ||
      coupon.minOrderValue < 0
    ) {
      return `Minimum order value for ${coupon.code} is invalid.`;
    }

    if (
      !Number.isFinite(coupon.maxDiscount) ||
      coupon.maxDiscount < 0
    ) {
      return `Maximum discount for ${coupon.code} is invalid.`;
    }

    if (
      coupon.discountType === "fixed" &&
      coupon.maxDiscount !== 0
    ) {
      return `Maximum discount must be 0 for fixed coupon ${coupon.code}.`;
    }

    if (
      coupon.usageLimit < 0 ||
      !Number.isInteger(coupon.usageLimit)
    ) {
      return `Usage limit for ${coupon.code} is invalid.`;
    }

    if (
      coupon.usageCount < 0 ||
      !Number.isInteger(coupon.usageCount)
    ) {
      return `Usage count for ${coupon.code} is invalid.`;
    }

    if (
      coupon.usageLimit > 0 &&
      coupon.usageCount > coupon.usageLimit
    ) {
      return `Usage count for ${coupon.code} cannot exceed its usage limit.`;
    }

    /*
     * Date validation
     *
     * We compare the date portion only for the "past date"
     * rule because the Admin calendar should not allow a
     * previous calendar date.
     */
    if (
      coupon.startsAt &&
      coupon.startsAt.slice(0, 10) < today
    ) {
      return `Start date for ${coupon.code} cannot be in the past.`;
    }

    if (
      coupon.expiresAt &&
      coupon.expiresAt.slice(0, 10) < today
    ) {
      return `Expiry date for ${coupon.code} cannot be in the past.`;
    }

    /*
     * Expiry must be the same as or later than start.
     */
    if (
      coupon.startsAt &&
      coupon.expiresAt &&
      coupon.expiresAt < coupon.startsAt
    ) {
      return `Expiry date for ${coupon.code} cannot be before the start date.`;
    }
  }

  return null;
}

/* -------------------------------------------------------------------------- */
/* GET                                                                        */
/* -------------------------------------------------------------------------- */

export async function GET() {
  try {
    if (!isAuthenticated()) {
      return NextResponse.json(
        {
          error: "Unauthorized",
        },
        {
          status: 401,
        }
      );
    }

    const coupons = await getCoupons();

    return NextResponse.json(
      coupons,
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
      "GET /api/admin/coupons failed:",
      error
    );

    return NextResponse.json(
      {
        error: "Failed to load coupons.",
      },
      {
        status: 500,
      }
    );
  }
}

/* -------------------------------------------------------------------------- */
/* PUT                                                                        */
/* -------------------------------------------------------------------------- */

export async function PUT(
  request: NextRequest
) {
  try {
    if (!isAuthenticated()) {
      return NextResponse.json(
        {
          error: "Unauthorized",
        },
        {
          status: 401,
        }
      );
    }

    const body = await request
      .json()
      .catch(() => null);

    if (!body || !Array.isArray(body.coupons)) {
      return NextResponse.json(
        {
          error:
            "Invalid request. Expected a coupons array.",
        },
        {
          status: 400,
        }
      );
    }

    /*
     * Read the current coupons first.
     *
     * This is important because usageCount belongs to the
     * actual coupon state and should not accidentally reset
     * when the admin edits another field.
     */
    const existingCoupons =
      await getCoupons();

    const existingById =
      new Map<string, Coupon>();

    const existingByCode =
      new Map<string, Coupon>();

    for (const coupon of existingCoupons) {
      existingById.set(
        coupon.id,
        coupon
      );

      existingByCode.set(
        coupon.code,
        coupon
      );
    }

    const normalizedCoupons: Coupon[] =
      body.coupons.map(
        (rawCoupon: Partial<Coupon>) => {
          const rawId =
            typeof rawCoupon.id === "string"
              ? rawCoupon.id
              : "";

          const rawCode = normalizeCode(
            rawCoupon.code
          );

          const existing =
            existingById.get(rawId) ??
            existingByCode.get(rawCode);

          return normalizeCoupon(
            rawCoupon,
            existing
          );
        }
      );

    /*
     * Preserve existing usage count when the admin did not
     * intentionally provide a new value.
     *
     * This prevents simply editing a coupon from resetting
     * its usage count.
     */
    for (
      let index = 0;
      index < normalizedCoupons.length;
      index += 1
    ) {
      const coupon =
        normalizedCoupons[index];

      const rawCoupon =
        body.coupons[index] as Partial<Coupon>;

      const existing =
        existingById.get(coupon.id) ??
        existingByCode.get(coupon.code);

      if (
        existing &&
        rawCoupon.usageCount === undefined
      ) {
        coupon.usageCount =
          existing.usageCount;
      }

      if (
        coupon.usageLimit > 0 &&
        coupon.usageCount >
          coupon.usageLimit
      ) {
        coupon.usageCount =
          coupon.usageLimit;
      }
    }

    const validationError =
      validateCouponData(
        normalizedCoupons
      );

    if (validationError) {
      return NextResponse.json(
        {
          error: validationError,
        },
        {
          status: 400,
        }
      );
    }

    /*
     * Save the normalized values.
     *
     * In particular, startsAt/expiresAt are saved exactly as
     * local datetime values such as:
     *
     * 2026-09-05T14:30
     *
     * so the browser does not show a shifted date after reload.
     */
    await saveCoupons(
      normalizedCoupons
    );

    /*
     * Read back from storage so the response reflects the
     * actual persisted state.
     */
    const savedCoupons =
      await getCoupons();

    return NextResponse.json(
      savedCoupons,
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
      "PUT /api/admin/coupons failed:",
      error
    );

    return NextResponse.json(
      {
        error: "Failed to save coupons.",
      },
      {
        status: 500,
      }
    );
  }
}