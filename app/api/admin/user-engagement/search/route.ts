import { NextResponse } from "next/server";

import { isAuthenticated } from "@/app/lib/adminAuth";
import {
  VALID_ORDER_RULE,
  cleanText,
  getAnalyticsDb,
  getAnalyticsPeriod,
  indiaDateKey,
  loadEvents,
  loadOrders,
  percent,
  periodCreatedAtFilter,
  publicPeriod,
  roundMoney,
  type BehaviourEvent,
} from "@/app/lib/userAnalytics";

export const dynamic = "force-dynamic";

type TimelineItem =
  | { kind: "search"; at: number; query: string; event: BehaviourEvent }
  | { kind: "view" | "cart"; at: number }
  | { kind: "order"; at: number; orderId: string; total: number };

interface QueryMetric {
  query: string;
  searches: number;
  resultSearches: number;
  zeroResultSearches: number;
  sessions: Set<string>;
  users: Set<string>;
  viewSessions: Set<string>;
  cartSessions: Set<string>;
  orderSessions: Set<string>;
  orders: number;
  revenue: number;
}

function normalizeQuery(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function searchText(event: BehaviourEvent): string {
  return (event.searchQuery || cleanText(event.metadata.query)).trim();
}

/** null = result count not recorded (treated as "had results"). */
function resultCount(event: BehaviourEvent): number | null {
  const value = Number(event.metadata.resultCount);
  return Number.isFinite(value) && value >= 0 ? Math.floor(value) : null;
}

/**
 * GET /api/admin/user-engagement/search?range=30d
 *
 * Search volume is counted per search event; conversion is counted per
 * search session (a browser session that searched), so one person searching
 * the same thing repeatedly can't inflate the rates.
 *
 * Attribution: inside a session, each product view / cart add / order
 * belongs to the most recent search before it (until the next search).
 * Orders and revenue come from valid orders, not tracking events.
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

    const [events, orders] = await Promise.all([
      loadEvents(db, {
        ...periodCreatedAtFilter(period),
        event: { $in: ["search", "product_view", "cart_add"] },
      }),
      loadOrders(db, {
        from: period.start,
        toExclusive: period.endExclusive,
        validOnly: true,
      }),
    ]);

    /* ---------------- Build each session's timeline ---------------- */

    const sessions = new Map<string, TimelineItem[]>();
    const push = (sessionId: string, item: TimelineItem) => {
      if (!sessionId) return;
      const list = sessions.get(sessionId) ?? [];
      list.push(item);
      sessions.set(sessionId, list);
    };

    const queryMap = new Map<string, QueryMetric>();
    const trendMap = new Map<
      string,
      { searches: number; queries: Set<string>; zeroResults: number; sessions: Set<string> }
    >();

    let totalSearches = 0;
    let searchesWithResults = 0;
    let zeroResultSearches = 0;
    const searchUsers = new Set<string>();

    for (const event of events) {
      const at = event.createdAt.getTime();

      if (event.event === "product_view") {
        push(event.sessionId, { kind: "view", at });
        continue;
      }

      if (event.event === "cart_add") {
        push(event.sessionId, { kind: "cart", at });
        continue;
      }

      const text = searchText(event);
      const query = normalizeQuery(text);
      if (!query) continue;

      const count = resultCount(event);
      const hasResults = count === null ? true : count > 0;

      totalSearches += 1;
      if (hasResults) searchesWithResults += 1;
      else zeroResultSearches += 1;
      if (event.userId) searchUsers.add(event.userId);

      const metric =
        queryMap.get(query) ??
        {
          query: text,
          searches: 0,
          resultSearches: 0,
          zeroResultSearches: 0,
          sessions: new Set<string>(),
          users: new Set<string>(),
          viewSessions: new Set<string>(),
          cartSessions: new Set<string>(),
          orderSessions: new Set<string>(),
          orders: 0,
          revenue: 0,
        };

      metric.searches += 1;
      if (hasResults) metric.resultSearches += 1;
      else metric.zeroResultSearches += 1;
      if (event.sessionId) metric.sessions.add(event.sessionId);
      if (event.userId) metric.users.add(event.userId);
      queryMap.set(query, metric);

      const dateKey = indiaDateKey(event.createdAt);
      const trend =
        trendMap.get(dateKey) ??
        { searches: 0, queries: new Set<string>(), zeroResults: 0, sessions: new Set<string>() };
      trend.searches += 1;
      trend.queries.add(query);
      if (!hasResults) trend.zeroResults += 1;
      if (event.sessionId) trend.sessions.add(event.sessionId);
      trendMap.set(dateKey, trend);

      push(event.sessionId, { kind: "search", at, query, event });
    }

    for (const order of orders) {
      push(order.sessionId, {
        kind: "order",
        at: order.createdAt.getTime(),
        orderId: order.id,
        total: order.total,
      });
    }

    /* ---------------- Attribute actions to searches ---------------- */

    const searchSessions = new Set<string>();
    const viewSessions = new Set<string>();
    const cartSessions = new Set<string>();
    const orderSessions = new Set<string>();
    const attributedOrderIds = new Set<string>();
    let attributedRevenue = 0;

    const KIND_RANK = { search: 0, view: 1, cart: 2, order: 3 } as const;

    for (const [sessionId, items] of sessions) {
      // Same timestamp: the search comes first, then view → cart → order.
      items.sort((a, b) => a.at - b.at || KIND_RANK[a.kind] - KIND_RANK[b.kind]);

      let currentQuery: string | null = null;

      for (const item of items) {
        if (item.kind === "search") {
          currentQuery = item.query;
          searchSessions.add(sessionId);
          continue;
        }

        if (!currentQuery) continue; // happened before any search

        const metric = queryMap.get(currentQuery)!;

        if (item.kind === "view") {
          viewSessions.add(sessionId);
          metric.viewSessions.add(sessionId);
        } else if (item.kind === "cart") {
          cartSessions.add(sessionId);
          metric.cartSessions.add(sessionId);
        } else if (
          item.kind === "order" &&
          !attributedOrderIds.has(item.orderId)
        ) {
          attributedOrderIds.add(item.orderId);
          orderSessions.add(sessionId);
          metric.orderSessions.add(sessionId);
          metric.orders += 1;
          metric.revenue += item.total;
          attributedRevenue += item.total;
        }
      }
    }

    const queries = Array.from(queryMap.values()).map((metric) => ({
      query: metric.query,
      searches: metric.searches,
      sessions: metric.sessions.size,
      users: metric.users.size,
      resultSearches: metric.resultSearches,
      zeroResultSearches: metric.zeroResultSearches,
      resultRate: percent(metric.resultSearches, metric.searches),
      zeroResultRate: percent(metric.zeroResultSearches, metric.searches),
      viewRate: percent(metric.viewSessions.size, metric.sessions.size),
      cartRate: percent(metric.cartSessions.size, metric.sessions.size),
      orderRate: percent(metric.orderSessions.size, metric.sessions.size),
      orders: metric.orders,
      revenue: roundMoney(metric.revenue),
    }));

    const topQueries = [...queries]
      .sort((a, b) => b.sessions - a.sessions || b.searches - a.searches || b.revenue - a.revenue)
      .slice(0, 20);

    const zeroResultQueries = queries
      .filter((item) => item.zeroResultSearches > 0)
      .sort((a, b) => b.zeroResultSearches - a.zeroResultSearches || b.searches - a.searches)
      .slice(0, 15)
      .map((item) => ({
        query: item.query,
        searches: item.searches,
        sessions: item.sessions,
        zeroResultSearches: item.zeroResultSearches,
        zeroResultRate: item.zeroResultRate,
      }));

    const trend = period.dateKeys
      .filter((date) => trendMap.has(date))
      .map((date) => {
        const value = trendMap.get(date)!;
        return {
          date,
          searches: value.searches,
          uniqueQueries: value.queries.size,
          zeroResults: value.zeroResults,
          searchSessions: value.sessions.size,
        };
      });

    return NextResponse.json({
      period: publicPeriod(period),
      summary: {
        totalSearches,
        uniqueQueries: queryMap.size,
        searchesWithResults,
        zeroResultSearches,
        resultRate: percent(searchesWithResults, totalSearches),
        zeroResultRate: percent(zeroResultSearches, totalSearches),
        searchSessions: searchSessions.size,
        searchUsers: searchUsers.size,
        searchesPerSession:
          searchSessions.size > 0
            ? Number((totalSearches / searchSessions.size).toFixed(2))
            : 0,
        sessionsWithView: viewSessions.size,
        sessionsWithCart: cartSessions.size,
        sessionsWithOrder: orderSessions.size,
        searchToViewRate: percent(viewSessions.size, searchSessions.size),
        searchToCartRate: percent(cartSessions.size, searchSessions.size),
        searchToOrderRate: percent(orderSessions.size, searchSessions.size),
        attributedOrders: attributedOrderIds.size,
        attributedRevenue: roundMoney(attributedRevenue),
      },
      topQueries,
      zeroResultQueries,
      trend,
      definitions: {
        searchSession: "A browser session that ran at least one search in the period.",
        attribution:
          "A product view, cart add or order is credited to the most recent search before it in the same session.",
        validOrders: VALID_ORDER_RULE,
      },
    });
  } catch (error) {
    console.error("[SEARCH ANALYTICS] Failed to load analytics", error);
    return NextResponse.json(
      { error: "Unable to load search analytics." },
      { status: 500 }
    );
  }
}
