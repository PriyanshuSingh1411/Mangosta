import Link from "next/link";
import { getProducts, getOrders } from "@/app/lib/dataStore";
import { formatPrice } from "@/app/data/productTypes";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const [products, orders] = await Promise.all([getProducts(), getOrders()]);

  const totalRevenue = orders
    .filter((o) => o.status !== "cancelled")
    .reduce((sum, o) => sum + o.total, 0);
  const pendingOrders = orders.filter((o) => o.status === "pending").length;
  const lowStock = products.filter((p) => p.inventory > 0 && p.inventory <= 10).length;
  const outOfStock = products.filter((p) => p.inventory === 0).length;

  const recentOrders = orders.slice(0, 5);

  return (
    <div>
      <p className="label-technical mb-2">OVERVIEW</p>
      <h1 className="mb-8 font-display text-2xl tracking-tight text-bone sm:mb-10 sm:text-3xl">Dashboard</h1>

      <div className="mb-10 grid grid-cols-2 gap-3 sm:mb-12 sm:gap-4 lg:grid-cols-4">
        <StatCard label="Revenue" value={formatPrice(totalRevenue)} />
        <StatCard label="Orders" value={String(orders.length)} sub={`${pendingOrders} pending`} />
        <StatCard label="Products" value={String(products.length)} />
        <StatCard
          label="Stock alerts"
          value={String(lowStock + outOfStock)}
          sub={outOfStock > 0 ? `${outOfStock} out of stock` : lowStock > 0 ? `${lowStock} low` : undefined}
          warn={lowStock + outOfStock > 0}
        />
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
                <span className="font-mono text-bone-dim">{formatPrice(order.total)}</span>
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
}: {
  label: string;
  value: string;
  sub?: string;
  warn?: boolean;
}) {
  return (
    <div className="min-w-0 border border-line px-4 py-4 sm:px-5">
      <p className="label-technical mb-2">{label}</p>
      <p className={`break-words font-display text-xl tracking-tight sm:text-2xl ${warn ? "text-mango" : "text-bone"}`}>
        {value}
      </p>
      {sub && <p className="mt-1 text-xs text-stone">{sub}</p>}
    </div>
  );
}

function StatusPill({ status }: { status: "pending" | "fulfilled" | "cancelled" }) {
  const styles: Record<string, string> = {
    pending: "text-mango border-mango/40",
    fulfilled: "text-bone-dim border-line-strong",
    cancelled: "text-stone-dark border-line",
  };
  return (
    <span className={`border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide ${styles[status]}`}>
      {status}
    </span>
  );
}
