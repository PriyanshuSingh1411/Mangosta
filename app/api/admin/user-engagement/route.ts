import { NextResponse } from "next/server";

import { isAuthenticated } from "@/app/lib/adminAuth";
import {
  ENGAGEMENT_SCORE_RULE,
  VALID_ORDER_RULE,
  buildSessionUserMap,
  getAnalyticsDb,
  getAnalyticsPeriod,
  indiaDateKey,
  isInPeriod,
  loadCustomerAnalytics,
  loadEvents,
  orderVisitorKey,
  percent,
  periodCreatedAtFilter,
  publicPeriod,
  roundMoney,
  visitorKey,
} from "@/app/lib/userAnalytics";

export const dynamic = "force-dynamic";
const MEANINGFUL_EVENTS = new Set([
  "product_view",
  "wishlist_add",
  "cart_add",
  "checkout_start",
  "purchase",
  "coupon_apply",
  "review_submit",
  "support_open",
  "product_share",
]);

interface TrendBucket {
  activeUsers: Set<string>;
  visitors: Set<string>;
  sessions: Set<string>;
  productViews: number;
  wishlistAdds: number;
  cartAdds: number;
  checkoutStarts: number;
  orders: number;
  revenue: number;
}

function emptyBucket(): TrendBucket {
  return {
    activeUsers: new Set(),
    visitors: new Set(),
    sessions: new Set(),
    productViews: 0,
    wishlistAdds: 0,
    cartAdds: 0,
    checkoutStarts: 0,
    orders: 0,
    revenue: 0,
  };
}

function overlap(a: Set<string>, b: Set<string>): number {
  const [small, large] = a.size <= b.size ? [a, b] : [b, a];
  let count = 0;
  for (const value of small) if (large.has(value)) count += 1;
  return count;
}

/**
 * GET /api/admin/user-engagement?range=30d
 *
 * User Engagement overview:
 *   - accounts: total / active / new / returning / engaged
 *   - unique-visitor conversion funnel (never above 100%)
 *   - orders & revenue from the orders collection
 *   - daily trend and the most recently active customers
 */
export async function GET(request: Request) {
  try {
    if (!(await isAuthenticated())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const period = getAnalyticsPeriod(
      new URL(request.url).searchParams.get("range")
    );
    const db = await getAnalyticsDb();

    const [events, customerResult, totalUsers] = await Promise.all([
      loadEvents(db, periodCreatedAtFilter(period), {
        event: 1,
        userId: 1,
        sessionId: 1,
        createdAt: 1,
      }),
      loadCustomerAnalytics(db, period, {
        userIds: "all",
        guestKeys: "all",
        onlyActiveInPeriod: true,
      }),
      db.collection("users").countDocuments(),
    ]);

    const { customers, directory, orders } = customerResult;

    const periodOrders = orders.filter(
      (order) => order.isValid && isInPeriod(order.createdAt, period)
    );

    /* ------------------------------------------------------------------
     * Unique-visitor funnel. A visitor is a signed-in customer, or a guest
     * browser session (merged into the customer when they sign in during
     * that session). Purchasers come from valid orders.
     * ---------------------------------------------------------------- */

    const sessionUsers = buildSessionUserMap(
      events
        .filter((event) => event.userId && event.sessionId)
        .map((event) => ({
          sessionId: event.sessionId,
          userId: event.userId,
          at: event.createdAt,
        }))
    );

    const funnel = {
      active: new Set<string>(),
      viewers: new Set<string>(),
      wishlisters: new Set<string>(),
      carters: new Set<string>(),
      checkouts: new Set<string>(),
      purchasers: new Set<string>(),
    };

    const trendMap = new Map<string, TrendBucket>(
      period.dateKeys.map((key) => [key, emptyBucket()])
    );

    const sessions = new Set<string>();
    const engagedUserIds = new Set<string>();
    const counts = {
      productViews: 0,
      wishlistAdds: 0,
      cartAdds: 0,
      checkoutStarts: 0,
    };

    for (const event of events) {
      const visitor = visitorKey(event.userId, event.sessionId, sessionUsers);
      const bucket = trendMap.get(indiaDateKey(event.createdAt));

      if (event.sessionId) {
        sessions.add(event.sessionId);
        bucket?.sessions.add(event.sessionId);
      }

      if (event.userId && directory.byId.has(event.userId)) {
        bucket?.activeUsers.add(event.userId);
        if (MEANINGFUL_EVENTS.has(event.event)) {
          engagedUserIds.add(event.userId);
        }
      }

      if (visitor) {
        funnel.active.add(visitor);
        bucket?.visitors.add(visitor);
      }

      switch (event.event) {
        case "product_view":
          counts.productViews += 1;
          if (bucket) bucket.productViews += 1;
          if (visitor) funnel.viewers.add(visitor);
          break;
        case "wishlist_add":
          counts.wishlistAdds += 1;
          if (bucket) bucket.wishlistAdds += 1;
          if (visitor) funnel.wishlisters.add(visitor);
          break;
        case "cart_add":
          counts.cartAdds += 1;
          if (bucket) bucket.cartAdds += 1;
          if (visitor) funnel.carters.add(visitor);
          break;
        case "checkout_start":
          counts.checkoutStarts += 1;
          if (bucket) bucket.checkoutStarts += 1;
          if (visitor) funnel.checkouts.add(visitor);
          break;
        default:
          break;
      }
    }

    let revenue = 0;

    // Every order placed in the period is activity; only valid orders count
    // as purchases and revenue.
    for (const order of orders) {
      if (!isInPeriod(order.createdAt, period)) continue;

      const visitor = orderVisitorKey(order, sessionUsers, directory);
      const bucket = trendMap.get(indiaDateKey(order.createdAt));
      const owner = directory.ownerOf(order);

      funnel.active.add(visitor);
      bucket?.visitors.add(visitor);

      if (owner.userId) {
        engagedUserIds.add(owner.userId);
        bucket?.activeUsers.add(owner.userId);
      }

      if (!order.isValid) continue;

      funnel.purchasers.add(visitor);
      revenue += order.total;

      if (bucket) {
        bucket.orders += 1;
        bucket.revenue += order.total;
      }
    }

    revenue = roundMoney(revenue);

    /* ------------------------------------------------------------------
     * Accounts: active / new / returning.
     *   Active    = account with tracked activity or an order in the period
     *   New       = first-ever activity (event or order) inside the period
     *   Returning = had activity before the period and again in it
     * ---------------------------------------------------------------- */

    const activeAccounts = customers.filter((customer) => !customer.isGuest);
    const activeAccountIds = new Set(
      activeAccounts.map((customer) => customer.userId as string)
    );

    let newUsers = 0;
    let returningUsers = 0;

    for (const customer of activeAccounts) {
      const firstActive = customer.firstActiveAt
        ? new Date(customer.firstActiveAt)
        : null;

      if (firstActive && firstActive.getTime() < period.start.getTime()) {
        returningUsers += 1;
      } else {
        newUsers += 1;
      }
    }

    const engagedUsers = Array.from(engagedUserIds).filter((id) =>
      activeAccountIds.has(id)
    ).length;

    const trend = period.dateKeys.map((date) => {
      const bucket = trendMap.get(date) ?? emptyBucket();
      return {
        date,
        activeUsers: bucket.activeUsers.size,
        visitors: bucket.visitors.size,
        sessions: bucket.sessions.size,
        productViews: bucket.productViews,
        wishlistAdds: bucket.wishlistAdds,
        cartAdds: bucket.cartAdds,
        checkoutStarts: bucket.checkoutStarts,
        orders: bucket.orders,
        revenue: roundMoney(bucket.revenue),
      };
    });

    const activity = [...customers]
      .sort(
        (a, b) =>
          (b.period.lastActiveAt ?? "").localeCompare(
            a.period.lastActiveAt ?? ""
          ) || b.engagementScore - a.engagementScore
      )
      .slice(0, 10);

    return NextResponse.json({
      period: publicPeriod(period),
      summary: {
        totalUsers,
        activeUsers: activeAccounts.length,
        newUsers,
        returningUsers,
        engagedUsers,
        visitors: funnel.active.size,
        sessions: sessions.size,
        productViews: counts.productViews,
        wishlistAdds: counts.wishlistAdds,
        cartAdds: counts.cartAdds,
        checkoutStarts: counts.checkoutStarts,
        orders: periodOrders.length,
        revenue,
        averageOrderValue:
          periodOrders.length > 0
            ? roundMoney(revenue / periodOrders.length)
            : 0,
        orderingVisitors: funnel.purchasers.size,
        visitorConversionRate: percent(
          funnel.purchasers.size,
          funnel.active.size
        ),
      },
      funnel: {
        activeVisitors: funnel.active.size,
        productViewers: funnel.viewers.size,
        wishlistCustomers: funnel.wishlisters.size,
        cartCustomers: funnel.carters.size,
        checkoutCustomers: funnel.checkouts.size,
        purchasingCustomers: funnel.purchasers.size,
        viewersWhoWishlisted: overlap(funnel.viewers, funnel.wishlisters),
        viewersWhoCarted: overlap(funnel.viewers, funnel.carters),
        cartersWhoCheckedOut: overlap(funnel.carters, funnel.checkouts),
        cartersWhoOrdered: overlap(funnel.carters, funnel.purchasers),
        checkoutsWhoOrdered: overlap(funnel.checkouts, funnel.purchasers),
      },
      trend,
      activity,
      definitions: {
        validOrders: VALID_ORDER_RULE,
        engagementScore: ENGAGEMENT_SCORE_RULE,
        visitor:
          "A signed-in customer, or a guest browser session (merged into the customer if they sign in during that session).",
        activeUsers:
          "Customer accounts with tracked activity or an order in the period.",
        newUsers:
          "Active accounts whose first-ever recorded activity (tracked event or order) is in the period.",
        returningUsers:
          "Active accounts that also had recorded activity before the period.",
      },
    });
  } catch (error) {
    console.error("[ADMIN USER ENGAGEMENT]", error);

    return NextResponse.json(
      { error: "Unable to load user engagement analytics." },
      { status: 500 }
    );
  }
}
