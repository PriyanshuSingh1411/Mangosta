import { NextResponse } from "next/server";

import { isAuthenticated } from "@/app/lib/adminAuth";
import {
  PRESENT_VALUE,
  VALID_ORDER_RULE,
  getAnalyticsDb,
  getAnalyticsPeriod,
  loadDirectoryForOrders,
  loadEvents,
  loadOrders,
  loadProductsById,
  loadSessionUserMap,
  netLineRevenue,
  orderVisitorKey,
  percent,
  periodCreatedAtFilter,
  publicPeriod,
  roundMoney,
  visitorKey,
} from "@/app/lib/userAnalytics";

export const dynamic = "force-dynamic";

const MIN_VIEWERS_FOR_DROP_OFF = 5;

/** Unique-visitor activity for one product or one category. */
class Funnel {
  views = 0;
  wishlistAdds = 0;
  cartAdds = 0;
  shares = 0;
  units = 0;
  revenue = 0;
  readonly orders = new Set<string>();
  /** visitor → first product view in the period */
  readonly viewers = new Map<string, number>();
  readonly wishlisters = new Set<string>();
  readonly carters = new Set<string>();
  readonly buyers = new Set<string>();
  /** viewers who bought after (or at) their first view */
  readonly viewerBuyers = new Set<string>();

  view(visitor: string, at: number) {
    this.views += 1;
    if (!visitor) return;
    const first = this.viewers.get(visitor);
    if (first === undefined || at < first) this.viewers.set(visitor, at);
  }

  buy(visitor: string, at: number, orderId: string, units: number, revenue: number) {
    this.units += units;
    this.revenue += revenue;
    this.orders.add(orderId);
    if (!visitor) return;
    this.buyers.add(visitor);
    const firstView = this.viewers.get(visitor);
    if (firstView !== undefined && firstView <= at) this.viewerBuyers.add(visitor);
  }

  overlap(set: Set<string>) {
    let count = 0;
    for (const visitor of this.viewers.keys()) if (set.has(visitor)) count += 1;
    return count;
  }

  rates() {
    const viewers = this.viewers.size;
    return {
      uniqueViewers: viewers,
      wishlistRate: percent(this.overlap(this.wishlisters), viewers),
      cartRate: percent(this.overlap(this.carters), viewers),
      conversionRate: percent(this.viewerBuyers.size, viewers),
      viewersWhoBought: this.viewerBuyers.size,
      buyers: this.buyers.size,
    };
  }
}

/**
 * GET /api/admin/user-engagement/products?range=30d
 *
 * Views, wishlist, cart and shares come from tracked events; units sold,
 * orders and revenue come from valid orders.
 *
 * Conversion = unique visitors who viewed the product and then bought it
 *              ÷ unique visitors who viewed it (always 0–100%).
 * Revenue    = line value net of the order's coupon/reward discount
 *              (shipping excluded).
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

    const [catalog, events, sessionUsers, orders] = await Promise.all([
      loadProductsById(db),
      loadEvents(
        db,
        {
          ...periodCreatedAtFilter(period),
          event: { $in: ["product_view", "wishlist_add", "cart_add", "product_share"] },
          productId: PRESENT_VALUE,
        },
        { event: 1, userId: 1, sessionId: 1, createdAt: 1, productId: 1 }
      ),
      loadSessionUserMap(db, period),
      loadOrders(db, {
        from: period.start,
        toExclusive: period.endExclusive,
        validOnly: true,
      }),
    ]);

    const directory = await loadDirectoryForOrders(db, orders);

    const productFunnels = new Map<string, Funnel>();
    const categoryFunnels = new Map<string, Funnel>();
    const overall = new Funnel();
    const orderNames = new Map<string, string>();

    const categoryOf = (productId: string) =>
      catalog.get(productId)?.category || "Uncategorized";

    const funnelsFor = (productId: string) => {
      const category = categoryOf(productId);
      if (!productFunnels.has(productId)) productFunnels.set(productId, new Funnel());
      if (!categoryFunnels.has(category)) categoryFunnels.set(category, new Funnel());
      return [productFunnels.get(productId)!, categoryFunnels.get(category)!, overall];
    };

    // Views first (events are oldest → newest), so "viewed before buying"
    // can be checked when orders are applied.
    for (const event of events) {
      const visitor = visitorKey(event.userId, event.sessionId, sessionUsers);
      const at = event.createdAt.getTime();

      for (const funnel of funnelsFor(event.productId)) {
        switch (event.event) {
          case "product_view":
            funnel.view(visitor, at);
            break;
          case "wishlist_add":
            funnel.wishlistAdds += 1;
            if (visitor) funnel.wishlisters.add(visitor);
            break;
          case "cart_add":
            funnel.cartAdds += 1;
            if (visitor) funnel.carters.add(visitor);
            break;
          case "product_share":
            funnel.shares += 1;
            break;
          default:
            break;
        }
      }
    }

    let orderRevenue = 0;
    let shippingRevenue = 0;

    for (const order of orders) {
      orderRevenue += order.total;
      shippingRevenue += order.shipping;

      const visitor = orderVisitorKey(order, sessionUsers, directory);
      const at = order.createdAt.getTime();
      const net = netLineRevenue(order);

      order.lines.forEach((line, index) => {
        if (!line.productId) return;
        if (!orderNames.has(line.productId)) orderNames.set(line.productId, line.productName);
        for (const funnel of funnelsFor(line.productId)) {
          funnel.buy(visitor, at, order.id, line.quantity, net[index]);
        }
      });
    }

    const overallRates = overall.rates();
    const averageConversion = overallRates.conversionRate;

    const productIds = new Set([...catalog.keys(), ...productFunnels.keys()]);

    const products = Array.from(productIds).map((productId) => {
      const funnel = productFunnels.get(productId) ?? new Funnel();
      const product = catalog.get(productId);
      const rates = funnel.rates();

      return {
        productId,
        name: product?.name || orderNames.get(productId) || productId,
        category: categoryOf(productId),
        image: product?.image || "",
        inCatalog: Boolean(product),
        views: funnel.views,
        ...rates,
        wishlistAdds: funnel.wishlistAdds,
        cartAdds: funnel.cartAdds,
        shares: funnel.shares,
        unitsSold: funnel.units,
        orders: funnel.orders.size,
        revenue: roundMoney(funnel.revenue),
        engagementScore:
          funnel.views +
          funnel.wishlistAdds * 3 +
          funnel.cartAdds * 5 +
          funnel.shares * 4 +
          funnel.units * 10,
      };
    });

    const categoryProductCounts = new Map<string, number>();
    for (const product of catalog.values()) {
      categoryProductCounts.set(
        product.category,
        (categoryProductCounts.get(product.category) ?? 0) + 1
      );
    }

    const categories = Array.from(
      new Set([...categoryProductCounts.keys(), ...categoryFunnels.keys()])
    )
      .map((category) => {
        const funnel = categoryFunnels.get(category) ?? new Funnel();
        return {
          category,
          products: categoryProductCounts.get(category) ?? 0,
          activeProducts: products.filter(
            (product) =>
              product.category === category &&
              (product.views > 0 || product.unitsSold > 0 || product.cartAdds > 0 || product.wishlistAdds > 0)
          ).length,
          views: funnel.views,
          ...funnel.rates(),
          wishlistAdds: funnel.wishlistAdds,
          cartAdds: funnel.cartAdds,
          shares: funnel.shares,
          unitsSold: funnel.units,
          orders: funnel.orders.size,
          revenue: roundMoney(funnel.revenue),
        };
      })
      .filter((category) => category.products > 0 || category.views > 0 || category.unitsSold > 0)
      .sort((a, b) => b.uniqueViewers - a.uniqueViewers || b.views - a.views || b.revenue - a.revenue);

    const top = <K extends keyof (typeof products)[number]>(key: K) =>
      [...products]
        .filter((product) => Number(product[key]) > 0)
        .sort((a, b) => Number(b[key]) - Number(a[key]) || b.engagementScore - a.engagementScore)
        .slice(0, 10);

    const belowAverage = <T extends { uniqueViewers: number; conversionRate: number }>(rows: T[]) =>
      rows
        .filter(
          (row) =>
            row.uniqueViewers >= MIN_VIEWERS_FOR_DROP_OFF &&
            row.conversionRate < averageConversion
        )
        .sort((a, b) => b.uniqueViewers - a.uniqueViewers);

    return NextResponse.json({
      period: publicPeriod(period),
      totals: {
        views: overall.views,
        uniqueViewers: overallRates.uniqueViewers,
        wishlistAdds: overall.wishlistAdds,
        cartAdds: overall.cartAdds,
        shares: overall.shares,
        unitsSold: overall.units,
        orders: orders.length,
        productRevenue: roundMoney(overall.revenue),
        orderRevenue: roundMoney(orderRevenue),
        shippingRevenue: roundMoney(shippingRevenue),
        conversionRate: averageConversion,
        viewersWhoBought: overallRates.viewersWhoBought,
      },
      products,
      categories,
      mostEngaged: [...products]
        .filter((product) => product.engagementScore > 0)
        .sort((a, b) => b.engagementScore - a.engagementScore)
        .slice(0, 20),
      mostViewed: top("uniqueViewers"),
      mostWishlisted: top("wishlistAdds"),
      mostAddedToCart: top("cartAdds"),
      mostPurchased: top("unitsSold"),
      highestRevenue: top("revenue"),
      highInterestLowConversion: belowAverage(products).slice(0, 10),
      categoryDropOff: belowAverage(categories).slice(0, 8),
      definitions: {
        validOrders: VALID_ORDER_RULE,
        conversion:
          "Unique visitors who viewed the product in the period and then bought it ÷ unique visitors who viewed it.",
        wishlistRate: "Unique viewers who also wishlisted it ÷ unique viewers.",
        cartRate: "Unique viewers who also added it to the bag ÷ unique viewers.",
        revenue:
          "Line value after the order's coupon / reward discount, excluding shipping. Product revenue + shipping = order revenue.",
        dropOff: `At least ${MIN_VIEWERS_FOR_DROP_OFF} unique viewers and conversion below the store average.`,
      },
    });
  } catch (error) {
    console.error("[PRODUCT ENGAGEMENT]", error);
    return NextResponse.json(
      { error: "Unable to load product engagement analytics." },
      { status: 500 }
    );
  }
}
