import Link from "next/link";
import { getProducts, getOrders } from "@/app/lib/dataStore";
import type { OrderStatus } from "@/app/lib/dataStore";
import { formatPrice, getProductSizes, hasVariantStock, variantKey } from "@/app/data/productTypes";
import { countOpenReturns } from "@/app/lib/returns";
import { countWaitingAlerts } from "@/app/lib/stockAlerts";
import SalesChart from "./SalesChart";
import type { SalesDay } from "./SalesChart";

export const dynamic = "force-dynamic";

const RANGES = [7, 30, 90] as const;
const LOW_VARIANT_STOCK = 3;
const LOW_PRODUCT_STOCK = 10;

function indiaDateKey(value: string | number | Date): string {
  return new Date(value).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

/** One empty entry per day for the last `range` days (India time). */
function emptyPeriod(range: number): SalesDay[] {
  const now = Date.now();
  return Array.from({ length: range }, (_, index) => ({
    date: indiaDateKey(now - (range - 1 - index) * 86_400_000),
    revenue: 0,
    orders: 0,
  }));
}

export default async function AdminDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const params = await searchParams;
  const range = RANGES.includes(Number(params.range) as (typeof RANGES)[number])
    ? Number(params.range)
    : 30;

  const [products, orders, openReturns, waitingAlerts] = await Promise.all([
    getProducts(),
    getOrders(),
    countOpenReturns().catch(() => 0),
    countWaitingAlerts().catch(() => 0),
  ]);

  // ---------------- period ----------------
  const days = emptyPeriod(range);
  const byDay = new Map(days.map((day) => [day.date, day]));

  const periodOrders = orders.filter(
    (order) => order.status !== "cancelled" && byDay.has(indiaDateKey(order.createdAt))
  );

  for (const order of periodOrders) {
    const day = byDay.get(indiaDateKey(order.createdAt))!;
    day.revenue += order.total;
    day.orders += 1;
  }

  const revenue = periodOrders.reduce((sum, order) => sum + order.total, 0);
  const averageOrder = periodOrders.length ? revenue / periodOrders.length : 0;
  const toShip = orders.filter((order) => order.status === "pending").length;

  // ---------------- best sellers ----------------
  const sales = new Map<string, { name: string; units: number; revenue: number }>();
  for (const order of periodOrders) {
    for (const line of order.lines) {
      const entry = sales.get(line.productId) ?? { name: line.productName, units: 0, revenue: 0 };
      entry.units += line.quantity;
      entry.revenue += line.price * line.quantity;
      sales.set(line.productId, entry);
    }
  }
  const bestSellers = [...sales.entries()]
    .map(([id, entry]) => ({ id, ...entry }))
    .sort((a, b) => b.units - a.units || b.revenue - a.revenue)
    .slice(0, 5);

  // ---------------- stock by size & colour ----------------
  const lowStock: { productId: string; name: string; variant: string; stock: number }[] = [];
  for (const product of products) {
    if (hasVariantStock(product)) {
      const colors = product.colors.length > 0 ? product.colors.map((c) => c.name) : [""];
      for (const color of colors) {
        for (const size of getProductSizes(product)) {
          const stock = Number(product.variantStock?.[variantKey(color, size)]) || 0;
          if (stock <= LOW_VARIANT_STOCK) {
            lowStock.push({
              productId: product.id,
              name: product.name,
              variant: [color, size].filter(Boolean).join(" / "),
              stock,
            });
          }
        }
      }
    } else if (product.inventory <= LOW_PRODUCT_STOCK) {
      lowStock.push({
        productId: product.id,
        name: product.name,
        variant: "All sizes",
        stock: product.inventory,
      });
    }
  }
  lowStock.sort((a, b) => a.stock - b.stock);
  const soldOutCount = lowStock.filter((item) => item.stock === 0).length;

  const recentOrders = orders.slice(0, 5);

  return (
    <div>
      <p className="label-technical mb-2">OVERVIEW</p>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4 sm:mb-10">
        <h1 className="type-heading text-bone">Dashboard</h1>

        <div className="flex flex-wrap items-center gap-2">
          {RANGES.map((option) => (
            <Link
              key={option}
              href={`/admin?range=${option}`}
              aria-current={range === option ? "page" : undefined}
              className={`px-3 py-2 text-xs tracking-wide transition-colors ${
                range === option
                  ? "bg-bone text-void"
                  : "border border-line-strong text-stone hover:border-bone hover:text-bone"
              }`}
            >
              {option} days
            </Link>
          ))}
          <a
            href="/api/admin/orders/export"
            download
            className="border border-line-strong px-3 py-2 text-xs tracking-wide text-bone transition-colors hover:border-bone"
          >
            Export orders ↓
          </a>
        </div>
      </div>

      <div className="mb-10 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
        <StatCard label={`Revenue · ${range}d`} value={formatPrice(revenue)} />
        <StatCard label={`Orders · ${range}d`} value={String(periodOrders.length)} />
        <StatCard label="Avg order" value={formatPrice(averageOrder)} />
        <StatCard
          label="To ship"
          value={String(toShip)}
          sub={toShip > 0 ? "processing orders" : undefined}
          warn={toShip > 0}
          href="/admin/orders"
        />
        <StatCard
          label="Open returns"
          value={String(openReturns)}
          warn={openReturns > 0}
          href="/admin/returns"
        />
        <StatCard
          label="Stock alerts"
          value={String(lowStock.length)}
          sub={
            soldOutCount > 0
              ? `${soldOutCount} sold out${waitingAlerts ? ` · ${waitingAlerts} waiting` : ""}`
              : waitingAlerts
                ? `${waitingAlerts} customers waiting`
                : undefined
          }
          warn={lowStock.length > 0}
        />
      </div>

      <section className="mb-10 border border-line p-4 sm:p-5">
        <div className="mb-4 flex items-baseline justify-between gap-3">
          <h2 className="text-sm font-medium tracking-wide text-bone">Daily revenue</h2>
          <p className="text-xs text-stone">Last {range} days · cancelled orders excluded</p>
        </div>
        <SalesChart days={days} />
      </section>

      <div className="mb-10 grid gap-6 lg:grid-cols-2">
        <section className="border border-line">
          <h2 className="border-b border-line px-4 py-3 text-sm font-medium tracking-wide text-bone sm:px-5">
            Best sellers · {range} days
          </h2>
          {bestSellers.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-stone">No sales in this period.</p>
          ) : (
            <ol>
              {bestSellers.map((item, index) => (
                <li
                  key={item.id}
                  className="flex items-center justify-between gap-3 border-b border-line px-4 py-3 text-sm last:border-b-0 sm:px-5"
                >
                  <span className="min-w-0 truncate text-bone-dim">
                    <span className="mr-2 font-mono text-xs text-stone">{index + 1}</span>
                    {item.name}
                  </span>
                  <span className="shrink-0 font-mono text-xs text-stone">
                    {item.units} sold · <span className="text-bone-dim">{formatPrice(item.revenue)}</span>
                  </span>
                </li>
              ))}
            </ol>
          )}
        </section>

        <section className="border border-line">
          <h2 className="border-b border-line px-4 py-3 text-sm font-medium tracking-wide text-bone sm:px-5">
            Low stock by size
          </h2>
          {lowStock.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-stone">Everything is well stocked.</p>
          ) : (
            <ul className="max-h-80 overflow-y-auto">
              {lowStock.slice(0, 30).map((item) => (
                <li key={`${item.productId}-${item.variant}`} className="border-b border-line last:border-b-0">
                  <Link
                    href={`/admin/products/${item.productId}`}
                    className="flex items-center justify-between gap-3 px-4 py-3 text-sm transition-colors hover:bg-charcoal sm:px-5"
                  >
                    <span className="min-w-0 truncate text-bone-dim">
                      {item.name} <span className="text-stone">— {item.variant}</span>
                    </span>
                    <span className={`shrink-0 font-mono text-xs ${item.stock === 0 ? "text-mango" : "text-stone"}`}>
                      {item.stock === 0 ? "SOLD OUT" : `${item.stock} left`}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-medium tracking-wide text-bone">Recent orders</h2>
        <Link href="/admin/orders" className="text-xs text-stone transition-colors hover:text-bone">
          View all →
        </Link>
      </div>

      {recentOrders.length === 0 ? (
        <div className="border border-line px-6 py-10 text-center">
          <p className="text-sm text-stone">No orders yet.</p>
        </div>
      ) : (
        <div className="border border-line">
          {recentOrders.map((order, i) => (
            <Link
              key={order.id}
              href={`/admin/orders#${order.id}`}
              className={`flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-4 text-sm transition-colors hover:bg-charcoal sm:px-5 ${
                i !== recentOrders.length - 1 ? "border-b border-line" : ""
              }`}
            >
              <div className="min-w-0">
                <p className="break-all text-bone">{order.id}</p>
                <p className="mt-0.5 text-xs text-stone">
                  {order.customer.firstName} {order.customer.lastName} ·{" "}
                  {new Date(order.createdAt).toLocaleDateString()}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-3 sm:gap-4">
                <StatusPill status={order.status} />
                <span className="type-price text-bone-dim">{formatPrice(order.total)}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  warn,
  href,
}: {
  label: string;
  value: string;
  sub?: string;
  warn?: boolean;
  href?: string;
}) {
  const body = (
    <>
      <p className="label-technical mb-2">{label}</p>
      <p className={`font-display text-lg tracking-tight [overflow-wrap:anywhere] sm:text-2xl ${warn ? "text-mango" : "text-bone"}`}>
        {value}
      </p>
      {sub && <p className="mt-1 text-xs text-stone">{sub}</p>}
    </>
  );

  return href ? (
    <Link href={href} className="block min-w-0 border border-line px-4 py-4 transition-colors hover:border-line-strong sm:px-5">
      {body}
    </Link>
  ) : (
    <div className="min-w-0 border border-line px-4 py-4 sm:px-5">{body}</div>
  );
}

function StatusPill({ status }: { status: OrderStatus }) {
  const styles: Record<OrderStatus, string> = {
    pending: "text-mango border-mango/40",
    shipped: "text-bone border-bone/40",
    delivered: "text-bone-dim border-line-strong",
    cancelled: "text-stone-dark border-line",
  };
  const labels: Record<OrderStatus, string> = {
    pending: "processing",
    shipped: "shipped",
    delivered: "delivered",
    cancelled: "cancelled",
  };
  return (
    <span className={`border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}
