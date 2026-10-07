import { NextResponse } from "next/server";

import { isAuthenticated } from "@/app/lib/adminAuth";
import {
  HIGH_VALUE_MIN_REVENUE,
  LOYAL_MIN_ORDERS,
  VALID_ORDER_RULE,
  getAnalyticsDb,
  getAnalyticsPeriod,
  isInPeriod,
  loadDirectoryForOrders,
  loadOrders,
  percent,
  publicPeriod,
  roundMoney,
  summarizeOrdersByCustomer,
  toIso,
  type CustomerOrderSummary,
} from "@/app/lib/userAnalytics";

export const dynamic = "force-dynamic";

function sumRevenue(rows: CustomerOrderSummary[], pick: (row: CustomerOrderSummary) => number) {
  return roundMoney(rows.reduce((sum, row) => sum + pick(row), 0));
}

function group(label: string, rows: CustomerOrderSummary[], pick: (row: CustomerOrderSummary) => number) {
  const revenue = sumRevenue(rows, pick);
  return {
    label,
    customers: rows.length,
    revenue,
    averageValue: rows.length > 0 ? roundMoney(revenue / rows.length) : 0,
  };
}

/**
 * GET /api/admin/user-engagement/ltv?range=30d
 *
 * Lifetime figures cover EVERY customer who has ever placed a valid order
 * (accounts + guest buyers by email) and don't depend on the date filter.
 * The "period" block covers the selected date range only.
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

    const orders = await loadOrders(db, { validOnly: true });
    const directory = await loadDirectoryForOrders(db, orders);
    const customers = Array.from(
      summarizeOrdersByCustomer(orders, directory, period).values()
    ).filter((customer) => customer.orders > 0);

    /* ---------------- Lifetime (all customers, all time) ---------------- */

    const lifetimeRevenue = sumRevenue(customers, (row) => row.revenue);
    const lifetimeOrders = customers.reduce((sum, row) => sum + row.orders, 0);
    const payingCustomers = customers.length;

    const oneTime = customers.filter((row) => row.orders === 1);
    const twoOrders = customers.filter((row) => row.orders === 2);
    const threePlus = customers.filter((row) => row.orders >= 3);
    const repeat = customers.filter((row) => row.orders >= LOYAL_MIN_ORDERS);
    const highValue = customers.filter((row) => row.revenue >= HIGH_VALUE_MIN_REVENUE);

    /* ---------------- Selected period ---------------- */

    const periodBuyers = customers.filter((row) => row.periodOrders > 0);
    const newBuyers = periodBuyers.filter((row) => isInPeriod(row.firstOrderAt, period));
    const returningBuyers = periodBuyers.filter(
      (row) => !isInPeriod(row.firstOrderAt, period)
    );
    const periodRevenue = sumRevenue(periodBuyers, (row) => row.periodRevenue);
    const periodOrders = periodBuyers.reduce((sum, row) => sum + row.periodOrders, 0);

    const topCustomers = [...customers]
      .sort(
        (a, b) =>
          b.revenue - a.revenue ||
          b.orders - a.orders ||
          a.identity.key.localeCompare(b.identity.key)
      )
      .slice(0, 10)
      .map((row) => {
        const user = row.identity.userId
          ? directory.byId.get(row.identity.userId)
          : undefined;
        const accountName = user
          ? [user.firstName, user.lastName].filter(Boolean).join(" ")
          : "";

        return {
          key: row.identity.key,
          userId: row.identity.userId,
          isGuest: row.identity.isGuest,
          name: accountName || row.orderName || (row.identity.isGuest ? "Guest customer" : "Customer"),
          email: user?.email || row.identity.email,
          orders: row.orders,
          revenue: row.revenue,
          averageOrderValue: roundMoney(row.revenue / row.orders),
          firstPurchaseAt: toIso(row.firstOrderAt),
          lastPurchaseAt: toIso(row.lastOrderAt),
        };
      });

    return NextResponse.json({
      period: publicPeriod(period),
      lifetime: {
        payingCustomers,
        registeredCustomers: customers.filter((row) => !row.identity.isGuest).length,
        guestCustomers: customers.filter((row) => row.identity.isGuest).length,
        lifetimeRevenue,
        lifetimeOrders,
        customerLifetimeValue:
          payingCustomers > 0 ? roundMoney(lifetimeRevenue / payingCustomers) : 0,
        averageOrderValue:
          lifetimeOrders > 0 ? roundMoney(lifetimeRevenue / lifetimeOrders) : 0,
        averageOrdersPerCustomer:
          payingCustomers > 0 ? Number((lifetimeOrders / payingCustomers).toFixed(2)) : 0,
        repeatBuyers: repeat.length,
        repeatPurchaseRate: percent(repeat.length, payingCustomers),
        oneTimeBuyers: oneTime.length,
        highValueCustomers: highValue.length,
      },
      periodSummary: {
        buyers: periodBuyers.length,
        orders: periodOrders,
        revenue: periodRevenue,
        averageOrderValue: periodOrders > 0 ? roundMoney(periodRevenue / periodOrders) : 0,
        newBuyers: newBuyers.length,
        returningBuyers: returningBuyers.length,
      },
      purchaseFrequency: [
        group("1 order", oneTime, (row) => row.revenue),
        group("2 orders", twoOrders, (row) => row.revenue),
        group("3+ orders", threePlus, (row) => row.revenue),
      ],
      customerTypes: [
        group("One-time buyers", oneTime, (row) => row.revenue),
        group("Repeat buyers (2+ orders)", repeat, (row) => row.revenue),
        group("High-value (₹10,000+)", highValue, (row) => row.revenue),
      ],
      periodBuyerTypes: [
        group("New buyers (first order in period)", newBuyers, (row) => row.periodRevenue),
        group("Returning buyers (ordered before)", returningBuyers, (row) => row.periodRevenue),
      ],
      topCustomers,
      definitions: {
        validOrders: VALID_ORDER_RULE,
        lifetime:
          "Lifetime figures include every customer who has ever placed a valid order (accounts and guest checkouts identified by email) and do not change with the date filter.",
        period: "Period figures only count valid orders placed in the selected date range.",
      },
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[ADMIN USER ENGAGEMENT LTV]", error);
    return NextResponse.json(
      { error: "Unable to load LTV analytics." },
      { status: 500 }
    );
  }
}
