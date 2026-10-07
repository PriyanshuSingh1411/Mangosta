import { NextResponse } from "next/server";
import type { Db, Document } from "mongodb";

import { isAuthenticated } from "@/app/lib/adminAuth";
import { getWishlistItems } from "@/app/lib/wishlist";
import {
  ENGAGEMENT_SCORE_RULE,
  ORDER_SEARCH_FIELDS,
  PRESENT_VALUE,
  USER_SEARCH_FIELDS,
  VALID_ORDER_RULE,
  anonymousEventFilter,
  buildCustomerAnalytics,
  buildSearchFilter,
  cleanText,
  escapeRegex,
  getAnalyticsDb,
  getAnalyticsPeriod,
  guestKey,
  guestSessionOwners,
  isSegmentKey,
  loadCustomerAnalytics,
  loadDirectoryForOrders,
  loadEvents,
  loadOrders,
  loadProductsById,
  loadUsers,
  normalizeEmail,
  periodCreatedAtFilter,
  publicPeriod,
  publicSegmentDefinitions,
  roundMoney,
  summarizeBehaviour,
  summarizeOrdersByCustomer,
  toAmount,
  toValidDate,
  userKey,
  type AnalyticsOrder,
  type AnalyticsPeriod,
  type CustomerAnalytics,
  type CustomerDirectory,
  type CustomerIdentity,
  type UserLite,
} from "@/app/lib/userAnalytics";

export const dynamic = "force-dynamic";

const TIMELINE_PAGE_SIZE = 50;

const SORT_KEYS = [
  "lastActive",
  "lifetimeValue",
  "orders",
  "score",
  "joined",
  "name",
] as const;

type SortKey = (typeof SORT_KEYS)[number];

function intParam(
  value: string | null,
  fallback: number,
  min: number,
  max: number
): number {
  const parsed = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function oneOf<T extends string>(
  value: string | null,
  allowed: readonly T[],
  fallback: T
): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

/* ==========================================================================
 * GET /api/admin/user-engagement/customer
 *
 *   ?search=&page=&limit=&sort=&dir=&type=&activity=&buyers=&segment=&range=
 *       → searchable, paged customer list (accounts + guest buyers)
 *   ?userId=…  or  ?email=… (guest buyer)  [&range=]
 *       → complete customer profile
 *   ?userId=… / ?email=…  &timeline=1&offset=&asOf=
 *       → next page of the activity timeline
 * ========================================================================== */

export async function GET(request: Request) {
  try {
    if (!(await isAuthenticated())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const params = new URL(request.url).searchParams;
    const period = getAnalyticsPeriod(params.get("range"));
    const db = await getAnalyticsDb();

    const userId = cleanText(params.get("userId"));
    const email = normalizeEmail(params.get("email"));

    if (userId || email) {
      const target = await loadCustomerTarget(db, userId, email);

      if (!target) {
        return NextResponse.json(
          { error: "Customer not found." },
          { status: 404 }
        );
      }

      if (params.get("timeline") === "1") {
        const asOf = toValidDate(params.get("asOf")) ?? new Date();
        const offset = intParam(params.get("offset"), 0, 0, 10_000_000);
        return NextResponse.json(
          await loadTimelinePage(db, target.eventScope, offset, asOf)
        );
      }

      return NextResponse.json(await buildProfile(db, period, target));
    }

    return NextResponse.json(await listCustomers(db, period, params));
  } catch (error) {
    console.error("[ADMIN CUSTOMER PROFILES]", error);

    return NextResponse.json(
      { error: "Unable to load customer data." },
      { status: 500 }
    );
  }
}

/* --------------------------------------------------------------------------
 * Customer list
 * ------------------------------------------------------------------------ */

function compareNullableText(
  a: string | null,
  b: string | null,
  direction: 1 | -1
): number {
  if (a === b) return 0;
  if (!a) return 1; // empty values always last
  if (!b) return -1;
  return a.localeCompare(b) * direction;
}

function sortCustomers(
  customers: CustomerAnalytics[],
  sort: SortKey,
  dir: "asc" | "desc"
) {
  const direction = dir === "asc" ? 1 : -1;

  customers.sort((a, b) => {
    let result = 0;

    switch (sort) {
      case "lifetimeValue":
        result = (a.lifetime.revenue - b.lifetime.revenue) * direction;
        break;
      case "orders":
        result = (a.lifetime.orders - b.lifetime.orders) * direction;
        break;
      case "score":
        result = (a.engagementScore - b.engagementScore) * direction;
        break;
      case "joined":
        result = compareNullableText(a.joinedAt, b.joinedAt, direction);
        break;
      case "name":
        result = compareNullableText(
          a.name.toLowerCase(),
          b.name.toLowerCase(),
          direction
        );
        break;
      case "lastActive":
      default:
        result = compareNullableText(a.lastActiveAt, b.lastActiveAt, direction);
        break;
    }

    return (
      result ||
      compareNullableText(a.lastActiveAt, b.lastActiveAt, -1) ||
      a.key.localeCompare(b.key)
    );
  });
}

async function listCustomers(
  db: Db,
  period: AnalyticsPeriod,
  params: URLSearchParams
) {
  const search = cleanText(params.get("search")).slice(0, 100);
  const limit = intParam(params.get("limit"), 25, 1, 100);
  const requestedPage = intParam(params.get("page"), 1, 1, 1_000_000);
  const sort = oneOf(params.get("sort"), SORT_KEYS, "lastActive");
  const dir = oneOf(params.get("dir"), ["asc", "desc"] as const, "desc");
  const type = oneOf(
    params.get("type"),
    ["all", "registered", "guest"] as const,
    "all"
  );
  const activity = oneOf(
    params.get("activity"),
    ["all", "active", "inactive"] as const,
    "all"
  );
  const buyers = oneOf(
    params.get("buyers"),
    ["all", "buyers", "non-buyers"] as const,
    "all"
  );
  const segmentParam = params.get("segment");
  const segment = isSegmentKey(segmentParam) ? segmentParam : "";

  // The database does the text search: accounts by email / name / id /
  // mobile, guest buyers by the details on their orders.
  let userIds: string[] | "all" = "all";
  let guestKeys: string[] | "all" | "none" = "all";

  if (type === "guest") userIds = [];
  if (type === "registered") guestKeys = "none";

  if (search) {
    if (type !== "guest") {
      const userFilter = buildSearchFilter(search, USER_SEARCH_FIELDS)!;
      const rows = await db
        .collection("users")
        .find(userFilter, { projection: { _id: 0, id: 1 } })
        .toArray();
      userIds = rows.map((row) => cleanText(row.id)).filter(Boolean);
    }

    if (type !== "registered") {
      const orderFilter = buildSearchFilter(search, ORDER_SEARCH_FIELDS)!;
      const rows = await db
        .collection("orders")
        .find(orderFilter, { projection: { _id: 0, "customer.email": 1 } })
        .toArray();
      guestKeys = [
        ...new Set(
          rows
            .map((row) => normalizeEmail(row.customer?.email))
            .filter(Boolean)
        ),
      ].map((value) => guestKey(value));
    }
  }

  const { customers } = await loadCustomerAnalytics(db, period, {
    userIds,
    guestKeys,
  });

  const filtered = customers.filter((customer) => {
    if (activity === "active" && !customer.period.active) return false;
    if (activity === "inactive" && customer.period.active) return false;
    if (buyers === "buyers" && customer.lifetime.orders === 0) return false;
    if (buyers === "non-buyers" && customer.lifetime.orders > 0) return false;
    if (segment && !customer.segments.includes(segment)) return false;
    return true;
  });

  sortCustomers(filtered, sort, dir);

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const page = Math.min(requestedPage, totalPages);
  const start = (page - 1) * limit;

  return {
    period: publicPeriod(period),
    query: { search, sort, dir, type, activity, buyers, segment },
    total,
    page,
    limit,
    totalPages,
    customers: filtered.slice(start, start + limit),
    segmentDefinitions: publicSegmentDefinitions(),
    definitions: {
      validOrders: VALID_ORDER_RULE,
      engagementScore: ENGAGEMENT_SCORE_RULE,
    },
  };
}

/* --------------------------------------------------------------------------
 * One customer (account or guest buyer)
 * ------------------------------------------------------------------------ */

interface CustomerTarget {
  user: UserLite | null;
  identity: CustomerIdentity;
  orders: AnalyticsOrder[];
  directory: CustomerDirectory;
  /** Mongo filter for this customer's tracked events (null = none). */
  eventScope: Document | null;
}

async function distinctOrderIds(db: Db, filter: Document): Promise<string[]> {
  const values = await db
    .collection("userEvents")
    .distinct("metadata.orderId", filter);
  return values.map((value) => cleanText(value)).filter(Boolean);
}

function orderIdCondition(ids: string[]): Document[] {
  return ids.length ? [{ id: { $in: ids } }, { _id: { $in: ids } }] : [];
}

async function loadCustomerTarget(
  db: Db,
  userId: string,
  email: string
): Promise<CustomerTarget | null> {
  let user: UserLite | null = null;

  if (userId) {
    user = (await loadUsers(db, { id: userId }))[0] ?? null;
    if (!user) return null;
  } else if (email) {
    user = (await loadUsers(db, { email }))[0] ?? null;
  }

  const targetEmail = user ? user.email : email;
  const key = user ? userKey(user.id) : guestKey(targetEmail);

  // Every order that could belong to this customer; the shared ownership
  // rule below keeps exactly the ones the other User pages give them.
  const conditions: Document[] = [];

  if (targetEmail) {
    conditions.push({
      "customer.email": new RegExp(`^${escapeRegex(targetEmail)}$`, "i"),
    });
  }

  if (user) {
    conditions.push({ userId: user.id });
    conditions.push(
      ...orderIdCondition(
        await distinctOrderIds(db, { event: "purchase", userId: user.id })
      )
    );
  }

  if (conditions.length === 0) return null;

  const candidates = await loadOrders(db, { match: { $or: conditions } });
  let directory = await loadDirectoryForOrders(
    db,
    candidates,
    user ? [user] : []
  );
  const orders = candidates.filter(
    (order) => directory.ownerOf(order).key === key
  );

  if (!user && orders.length === 0) return null;

  const identity: CustomerIdentity = user
    ? directory.userIdentity(user)
    : { key, userId: null, email: targetEmail, isGuest: true };

  if (user) {
    return { user, identity, orders, directory, eventScope: { userId: user.id } };
  }

  // Guest: their browsing is the anonymous activity of the sessions that
  // placed their orders (a session shared by several guests belongs to the
  // guest with the latest order — the same rule the customer list uses).
  let sessionIds = [
    ...new Set(orders.map((order) => order.sessionId).filter(Boolean)),
  ];

  if (sessionIds.length > 0) {
    const related = await loadOrders(db, {
      match: {
        $or: [
          { engagementSessionId: { $in: sessionIds } },
          ...orderIdCondition(
            await distinctOrderIds(db, {
              event: "purchase",
              sessionId: { $in: sessionIds },
            })
          ),
        ],
      },
    });

    const merged = new Map<string, AnalyticsOrder>();
    for (const order of [...orders, ...related]) merged.set(order.id, order);
    const allOrders = Array.from(merged.values());

    directory = await loadDirectoryForOrders(db, allOrders);
    const owners = guestSessionOwners(allOrders, directory);
    sessionIds = sessionIds.filter((sessionId) => owners.get(sessionId) === key);
  }

  return {
    user: null,
    identity,
    orders,
    directory,
    eventScope:
      sessionIds.length > 0
        ? { sessionId: { $in: sessionIds }, ...anonymousEventFilter() }
        : null,
  };
}

const LIFETIME_EVENT_KEYS: Record<string, string> = {
  product_view: "productViews",
  wishlist_add: "wishlistAdds",
  cart_add: "cartAdds",
  checkout_start: "checkoutStarts",
  search: "searches",
};

async function buildProfile(
  db: Db,
  period: AnalyticsPeriod,
  target: CustomerTarget
) {
  const { user, identity, orders, directory, eventScope } = target;
  const key = identity.key;

  const orderSummary =
    summarizeOrdersByCustomer(orders, directory, period).get(key) ?? null;

  const [periodEvents, eventCounts, sessionIds, viewedRows, wishlist, timeline] =
    await Promise.all([
      eventScope
        ? loadEvents(
            db,
            { ...eventScope, ...periodCreatedAtFilter(period) },
            { event: 1, userId: 1, sessionId: 1, createdAt: 1 }
          )
        : Promise.resolve([]),
      eventScope
        ? db
            .collection("userEvents")
            .aggregate([
              { $match: eventScope },
              {
                $group: {
                  _id: "$event",
                  count: { $sum: 1 },
                  firstAt: { $min: "$createdAt" },
                  lastAt: { $max: "$createdAt" },
                },
              },
            ])
            .toArray()
        : Promise.resolve([] as Document[]),
      eventScope
        ? db.collection("userEvents").distinct("sessionId", eventScope)
        : Promise.resolve([] as unknown[]),
      eventScope
        ? db
            .collection("userEvents")
            .aggregate([
              {
                $match: {
                  ...eventScope,
                  event: "product_view",
                  productId: PRESENT_VALUE,
                },
              },
              {
                $group: {
                  _id: "$productId",
                  views: { $sum: 1 },
                  lastViewedAt: { $max: "$createdAt" },
                },
              },
            ])
            .toArray()
        : Promise.resolve([] as Document[]),
      user ? getWishlistItems(user.id).catch(() => []) : Promise.resolve([]),
      loadTimelinePage(db, eventScope, 0, new Date()),
    ]);

  /* Lifetime behaviour — every tracked event, no limit. */
  const lifetime = {
    events: 0,
    sessions: sessionIds.map((value) => cleanText(value)).filter(Boolean)
      .length,
    productViews: 0,
    wishlistAdds: 0,
    cartAdds: 0,
    checkoutStarts: 0,
    searches: 0,
  };
  let firstEventAt: Date | null = null;
  let lastEventAt: Date | null = null;

  for (const row of eventCounts) {
    const count = toAmount(row.count);
    lifetime.events += count;
    const field = LIFETIME_EVENT_KEYS[cleanText(row._id)];
    if (field) (lifetime as Record<string, number>)[field] += count;

    const firstAt = toValidDate(row.firstAt);
    const lastAt = toValidDate(row.lastAt);
    if (firstAt && (!firstEventAt || firstAt < firstEventAt)) firstEventAt = firstAt;
    if (lastAt && (!lastEventAt || lastAt > lastEventAt)) lastEventAt = lastAt;
  }

  const behaviour =
    summarizeBehaviour(periodEvents, () => key).get(key) ?? null;

  const customer = buildCustomerAnalytics({
    identity,
    user,
    orderSummary,
    behaviour,
    eventBounds: { firstAt: firstEventAt, lastAt: lastEventAt },
  });

  /* Product names for wishlist + viewed products. */
  const productIds = [
    ...new Set([
      ...wishlist.map((item) => item.productId),
      ...viewedRows.map((row) => cleanText(row._id)),
    ]),
  ].filter(Boolean);
  const products = await loadProductsById(db, productIds);

  const viewedProducts = viewedRows
    .map((row) => {
      const productId = cleanText(row._id);
      return {
        productId,
        name: products.get(productId)?.name || productId,
        slug: products.get(productId)?.slug || "",
        views: toAmount(row.views),
        lastViewedAt: toValidDate(row.lastViewedAt)?.toISOString() ?? null,
      };
    })
    .sort(
      (a, b) =>
        b.views - a.views ||
        (b.lastViewedAt ?? "").localeCompare(a.lastViewedAt ?? "")
    );

  const orderRows = [...orders]
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .map((order) => ({
      id: order.id,
      createdAt: order.createdAt.toISOString(),
      status: order.status,
      paymentStatus: order.paymentStatus,
      countsAsRevenue: order.isValid,
      total: order.total,
      itemCount: order.itemCount,
      lines: order.lines,
    }));

  return {
    period: publicPeriod(period),
    customer: {
      key,
      id: user?.id ?? "",
      isGuest: identity.isGuest,
      email: customer.email,
      firstName:
        user?.firstName ?? orders[orders.length - 1]?.firstName ?? "",
      lastName: user?.lastName ?? orders[orders.length - 1]?.lastName ?? "",
      name: customer.name,
      mobile: customer.mobile,
      createdAt: user?.createdAt?.toISOString() ?? null,
      lastLoginAt: user?.lastLoginAt?.toISOString() ?? null,
      emailVerified: user?.emailVerified ?? false,
    },
    summary: {
      firstActivityAt: customer.firstActiveAt,
      lastActiveAt: customer.lastActiveAt,
      joinedAt: customer.joinedAt,
      lifetime: {
        ...lifetime,
        orders: customer.lifetime.orders,
        revenue: customer.lifetime.revenue,
        averageOrderValue: customer.lifetime.averageOrderValue,
        cancelledOrders: orderSummary?.cancelledOrders ?? 0,
        firstOrderAt: customer.lifetime.firstOrderAt,
        lastOrderAt: customer.lifetime.lastOrderAt,
      },
      period: customer.period,
      ltv: customer.lifetime.revenue,
      engagementScore: customer.engagementScore,
      segment: customer.segment,
      segments: customer.segments,
    },
    wishlist: wishlist.map((item) => ({
      productId: item.productId,
      name: products.get(item.productId)?.name || item.productId,
      slug: products.get(item.productId)?.slug || "",
      folder: item.folder,
      addedAt: item.addedAt,
      priceAtSave: roundMoney(item.priceAtSave),
    })),
    viewedProducts,
    orders: orderRows,
    timeline,
    segmentDefinitions: publicSegmentDefinitions(),
    definitions: {
      validOrders: VALID_ORDER_RULE,
      engagementScore: ENGAGEMENT_SCORE_RULE,
      guestActivity: identity.isGuest
        ? "Guest activity is the anonymous browsing of the sessions that placed this customer's orders."
        : "",
    },
  };
}

/* --------------------------------------------------------------------------
 * Activity timeline (paged; asOf keeps pages stable while new events arrive)
 * ------------------------------------------------------------------------ */

function primitiveDetails(metadata: unknown): Record<string, string | number | boolean> {
  const details: Record<string, string | number | boolean> = {};
  if (!metadata || typeof metadata !== "object") return details;

  for (const [field, value] of Object.entries(metadata as Document)) {
    if (
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
    ) {
      details[field] = value;
    }
  }

  return details;
}

async function loadTimelinePage(
  db: Db,
  eventScope: Document | null,
  offset: number,
  asOf: Date
) {
  if (!eventScope) {
    return {
      events: [],
      total: 0,
      offset,
      nextOffset: null as number | null,
      asOf: asOf.toISOString(),
    };
  }

  const filter = { ...eventScope, createdAt: { $lte: asOf } };
  const collection = db.collection("userEvents");

  const [total, rows] = await Promise.all([
    collection.countDocuments(filter),
    collection
      .find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .skip(offset)
      .limit(TIMELINE_PAGE_SIZE)
      .toArray(),
  ]);

  const missingNames = [
    ...new Set(
      rows
        .filter((row) => row.productId && !cleanText(row.metadata?.productName))
        .map((row) => cleanText(row.productId))
    ),
  ];
  const products = await loadProductsById(db, missingNames);

  const events = rows.map((row) => {
    const productId = cleanText(row.productId);
    return {
      id: String(row._id ?? ""),
      event: cleanText(row.event),
      createdAt: toValidDate(row.createdAt)?.toISOString() ?? null,
      productId,
      productName:
        cleanText(row.metadata?.productName) ||
        products.get(productId)?.name ||
        "",
      searchQuery: cleanText(row.searchQuery),
      path: cleanText(row.path),
      details: primitiveDetails(row.metadata),
    };
  });

  const nextOffset = offset + rows.length;

  return {
    events,
    total,
    offset,
    nextOffset: nextOffset < total && rows.length > 0 ? nextOffset : null,
    asOf: asOf.toISOString(),
  };
}
