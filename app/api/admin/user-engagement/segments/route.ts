import { NextResponse } from "next/server";
import { ObjectId, type Db } from "mongodb";

import { isAuthenticated } from "@/app/lib/adminAuth";
import {
  DAY_MS,
  ENGAGEMENT_SCORE_RULE,
  SEGMENT_DEFINITIONS,
  VALID_ORDER_RULE,
  cleanText,
  getAnalyticsDb,
  getAnalyticsPeriod,
  isSegmentKey,
  loadCustomerAnalytics,
  percent,
  publicPeriod,
  publicSegmentDefinitions,
  type CustomerAnalytics,
  type SegmentKey,
} from "@/app/lib/userAnalytics";

export const dynamic = "force-dynamic";

/**
 * Segment criteria.
 *   Period behaviour (selected date range): minViews, minWishlist, minCart
 *   Lifetime value (valid orders, all time):  minOrders, minRevenue
 *   Inactivity (relative to now):             inactiveDays
 *   Shared segment definition:                segment
 */
interface SegmentCriteria {
  minViews: number;
  minWishlist: number;
  minCart: number;
  minOrders: number;
  minRevenue: number;
  inactiveDays: number;
  segment: SegmentKey | "";
}

const EMPTY_CRITERIA: SegmentCriteria = {
  minViews: 0,
  minWishlist: 0,
  minCart: 0,
  minOrders: 0,
  minRevenue: 0,
  inactiveDays: 0,
  segment: "",
};

const PRESETS: Record<string, Partial<SegmentCriteria>> = {
  "product-viewers": { minViews: 3 },
  "cart-abandoners": { segment: "cart-abandoners" },
  "high-value": { segment: "high-value" },
  loyal: { segment: "loyal" },
  "wishlist-heavy": { segment: "wishlist-heavy" },
  "highly-engaged": { segment: "highly-engaged" },
  browsers: { segment: "browsers" },
  "inactive-30d": { inactiveDays: 30 },
};

function nonNegative(value: unknown, integer = false): number {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return 0;
  return integer ? Math.floor(number) : number;
}

/** Cleans criteria from the browser or from an older saved segment. */
function normalizeCriteria(raw: unknown): SegmentCriteria {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ...EMPTY_CRITERIA };
  }

  const source = raw as Record<string, unknown>;

  return {
    minViews: nonNegative(source.minViews, true),
    minWishlist: nonNegative(source.minWishlist, true),
    minCart: nonNegative(source.minCart, true),
    // Saved segments created before this update used "minPurchases".
    minOrders: nonNegative(source.minOrders ?? source.minPurchases, true),
    minRevenue: nonNegative(source.minRevenue),
    inactiveDays: nonNegative(source.inactiveDays, true),
    segment: isSegmentKey(source.segment) ? source.segment : "",
  };
}

function matchesCriteria(
  customer: CustomerAnalytics,
  criteria: SegmentCriteria,
  now: number
): boolean {
  if (customer.period.productViews < criteria.minViews) return false;
  if (customer.period.wishlistAdds < criteria.minWishlist) return false;
  if (customer.period.cartAdds < criteria.minCart) return false;
  if (customer.lifetime.orders < criteria.minOrders) return false;
  if (customer.lifetime.revenue < criteria.minRevenue) return false;

  if (criteria.inactiveDays > 0) {
    const cutoff = now - criteria.inactiveDays * DAY_MS;
    const lastActive = customer.lastActiveAt
      ? new Date(customer.lastActiveAt).getTime()
      : null;
    if (lastActive !== null && lastActive > cutoff) return false;
  }

  if (criteria.segment && !customer.segments.includes(criteria.segment)) {
    return false;
  }

  return true;
}

function byEngagement(a: CustomerAnalytics, b: CustomerAnalytics): number {
  return (
    b.engagementScore - a.engagementScore ||
    b.lifetime.revenue - a.lifetime.revenue ||
    (b.lastActiveAt ?? "").localeCompare(a.lastActiveAt ?? "") ||
    a.key.localeCompare(b.key)
  );
}

function csvCell(value: unknown): string {
  let text = String(value ?? "");
  // Stop spreadsheet apps from running a cell as a formula.
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

function segmentLabel(key: string): string {
  return SEGMENT_DEFINITIONS.find((item) => item.key === key)?.label ?? key;
}

function toCsv(customers: CustomerAnalytics[]): string {
  const header = [
    "Name",
    "Email",
    "Customer type",
    "User ID",
    "Period sessions",
    "Period product views",
    "Period wishlist adds",
    "Period cart adds",
    "Period orders",
    "Period revenue",
    "Lifetime orders",
    "Lifetime revenue",
    "Engagement score (period)",
    "Primary segment",
    "All segments",
    "Last active",
    "Joined / first order",
  ];

  const rows = customers.map((customer) =>
    [
      customer.name,
      customer.email,
      customer.isGuest ? "Guest" : "Account",
      customer.userId ?? "",
      customer.period.sessions,
      customer.period.productViews,
      customer.period.wishlistAdds,
      customer.period.cartAdds,
      customer.period.orders,
      customer.period.revenue,
      customer.lifetime.orders,
      customer.lifetime.revenue,
      customer.engagementScore,
      customer.segment.label,
      customer.segments.map(segmentLabel).join("; "),
      customer.lastActiveAt ?? "",
      customer.joinedAt ?? "",
    ]
      .map(csvCell)
      .join(",")
  );

  return `﻿${[header.map(csvCell).join(","), ...rows].join("\r\n")}`;
}

async function loadSavedSegments(db: Db) {
  const saved = await db
    .collection("engagementSegments")
    .find({})
    .sort({ createdAt: -1 })
    .toArray();

  return saved.map((segment) => ({
    id: String(segment._id),
    name: cleanText(segment.name) || "Untitled segment",
    criteria: normalizeCriteria(segment.criteria),
    createdAt: segment.createdAt ?? null,
    updatedAt: segment.updatedAt ?? segment.createdAt ?? null,
  }));
}

function parseObjectId(value: unknown): ObjectId | null {
  const id = cleanText(value);
  return ObjectId.isValid(id) && String(new ObjectId(id)) === id.toLowerCase()
    ? new ObjectId(id)
    : null;
}

function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

/* ==========================================================================
 * GET /api/admin/user-engagement/segments
 *   ?range=30d&criteria={...}|&preset=cart-abandoners&page=1&limit=50
 *   &export=csv  → every matching customer as CSV
 * ========================================================================== */

export async function GET(request: Request) {
  try {
    if (!(await isAuthenticated())) return unauthorized();

    const params = new URL(request.url).searchParams;
    const period = getAnalyticsPeriod(params.get("range"));
    const presetKey = cleanText(params.get("preset") ?? params.get("segment"));

    let criteria: SegmentCriteria;
    try {
      const raw = params.get("criteria");
      criteria = raw
        ? normalizeCriteria(JSON.parse(raw))
        : normalizeCriteria({ ...EMPTY_CRITERIA, ...(PRESETS[presetKey] ?? {}) });
    } catch {
      return NextResponse.json(
        { error: "Invalid segment criteria." },
        { status: 400 }
      );
    }

    const db = await getAnalyticsDb();
    const { customers } = await loadCustomerAnalytics(db, period, {
      userIds: "all",
      guestKeys: "all",
    });

    const now = Date.now();
    const matching = customers
      .filter((customer) => matchesCriteria(customer, criteria, now))
      .sort(byEngagement);

    if (params.get("export") === "csv") {
      const name = (presetKey || "segment").replace(/[^a-z0-9-]/gi, "") || "segment";
      return new NextResponse(toCsv(matching), {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="mangosta-${name}-${period.startKey}-to-${period.endKey}.csv"`,
          "Cache-Control": "no-store",
        },
      });
    }

    const limit = Math.min(200, Math.max(1, Number.parseInt(params.get("limit") ?? "", 10) || 50));
    const totalPages = Math.max(1, Math.ceil(matching.length / limit));
    const page = Math.min(
      totalPages,
      Math.max(1, Number.parseInt(params.get("page") ?? "", 10) || 1)
    );

    // Overview cards: customers active in the selected period.
    const active = customers.filter((customer) => customer.period.active);
    const countIn = (key: SegmentKey) =>
      active.filter((customer) => customer.segments.includes(key)).length;

    return NextResponse.json({
      period: publicPeriod(period),
      criteria,
      total: matching.length,
      page,
      limit,
      totalPages,
      customers: matching.slice((page - 1) * limit, page * limit),
      summary: {
        activeCustomers: active.length,
        averageScore:
          active.length > 0
            ? Math.round(
                active.reduce((sum, customer) => sum + customer.engagementScore, 0) /
                  active.length
              )
            : 0,
        highlyEngaged: countIn("highly-engaged"),
        highValue: countIn("high-value"),
        cartAbandoners: countIn("cart-abandoners"),
        segments: SEGMENT_DEFINITIONS.map((definition) => {
          const count = countIn(definition.key);
          return {
            key: definition.key,
            label: definition.label,
            scope: definition.scope,
            description: definition.description,
            customers: count,
            share: percent(count, active.length),
          };
        }),
        mostEngaged: [...active].sort(byEngagement).slice(0, 10),
      },
      segmentDefinitions: publicSegmentDefinitions(),
      savedSegments: await loadSavedSegments(db),
      definitions: {
        validOrders: VALID_ORDER_RULE,
        engagementScore: ENGAGEMENT_SCORE_RULE,
        periodFields:
          "Views, wishlist, cart, sessions and engagement score use the selected period.",
        lifetimeFields:
          "Orders and revenue filters (and High Value / Loyal) use lifetime valid orders.",
        inactiveDays:
          "No tracked activity and no order in the last N days (counted from today).",
      },
    });
  } catch (error) {
    console.error("[ADMIN USER SEGMENTS]", error);
    return NextResponse.json(
      { error: "Unable to load customer segments." },
      { status: 500 }
    );
  }
}

/* POST — save the current criteria as a named segment. */
export async function POST(request: Request) {
  try {
    if (!(await isAuthenticated())) return unauthorized();

    const body = await request.json().catch(() => null);
    const name = cleanText(body?.name).slice(0, 80);

    if (!name) {
      return NextResponse.json(
        { error: "Segment name is required." },
        { status: 400 }
      );
    }

    const criteria = normalizeCriteria(body?.criteria);
    const now = new Date();
    const db = await getAnalyticsDb();
    const result = await db
      .collection("engagementSegments")
      .insertOne({ name, criteria, createdAt: now, updatedAt: now });

    return NextResponse.json(
      { id: String(result.insertedId), name, criteria, createdAt: now, updatedAt: now },
      { status: 201 }
    );
  } catch (error) {
    console.error("[ADMIN USER SEGMENTS] save", error);
    return NextResponse.json({ error: "Unable to save segment." }, { status: 500 });
  }
}

/* PATCH — rename a saved segment and/or replace its criteria. */
export async function PATCH(request: Request) {
  try {
    if (!(await isAuthenticated())) return unauthorized();

    const body = await request.json().catch(() => null);
    const id = parseObjectId(body?.id);

    if (!id) {
      return NextResponse.json({ error: "A valid segment id is required." }, { status: 400 });
    }

    const update: Record<string, unknown> = { updatedAt: new Date() };

    if (body?.name !== undefined) {
      const name = cleanText(body.name).slice(0, 80);
      if (!name) {
        return NextResponse.json({ error: "Segment name is required." }, { status: 400 });
      }
      update.name = name;
    }

    if (body?.criteria !== undefined) {
      update.criteria = normalizeCriteria(body.criteria);
    }

    const db = await getAnalyticsDb();
    const result = await db
      .collection("engagementSegments")
      .updateOne({ _id: id }, { $set: update });

    if (result.matchedCount === 0) {
      return NextResponse.json({ error: "Segment not found." }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[ADMIN USER SEGMENTS] update", error);
    return NextResponse.json({ error: "Unable to update segment." }, { status: 500 });
  }
}

/* DELETE ?id= — remove a saved segment. */
export async function DELETE(request: Request) {
  try {
    if (!(await isAuthenticated())) return unauthorized();

    const id = parseObjectId(new URL(request.url).searchParams.get("id"));

    if (!id) {
      return NextResponse.json({ error: "A valid segment id is required." }, { status: 400 });
    }

    const db = await getAnalyticsDb();
    const result = await db.collection("engagementSegments").deleteOne({ _id: id });

    if (result.deletedCount === 0) {
      return NextResponse.json({ error: "Segment not found." }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[ADMIN USER SEGMENTS] delete", error);
    return NextResponse.json({ error: "Unable to delete segment." }, { status: 500 });
  }
}
