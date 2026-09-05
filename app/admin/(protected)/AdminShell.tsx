"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";

const NAV_ITEMS = [
  { label: "Dashboard", href: "/admin" },
  { label: "Products", href: "/admin/products" },
  { label: "Orders", href: "/admin/orders" },
  { label: "Settings", href: "/admin/settings" },
  { label: "Email", href: "/admin/email" },
  { label: "Checkout", href: "/admin/checkout" },
  { label: "Coupons", href: "/admin/coupons" },
];

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/admin/login");
    router.refresh();
  };

  const isActive = (href: string) =>
    href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);

  return (
    <div className="flex min-h-screen bg-void text-bone">
      <aside className="flex w-60 shrink-0 flex-col border-r border-line px-5 py-6">
        <Link href="/admin" className="mb-10 flex items-center gap-2.5">
          <div className="relative h-6 w-9">
            <Image src="/images/mark-white.png" alt="" fill sizes="36px" className="object-contain" />
          </div>
          <span className="font-display text-base tracking-tight">MANGOSTA</span>
        </Link>

        <nav className="flex flex-1 flex-col gap-1" aria-label="Admin">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`px-3 py-2.5 text-sm transition-colors ${
                isActive(item.href)
                  ? "bg-charcoal-raised text-bone"
                  : "text-stone hover:bg-charcoal hover:text-bone-dim"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex flex-col gap-2 border-t border-line pt-5">
          <Link
            href="/"
            target="_blank"
            className="px-3 py-2 text-xs text-stone transition-colors hover:text-bone-dim"
          >
            View storefront ↗
          </Link>
          <button
            type="button"
            onClick={handleLogout}
            className="px-3 py-2 text-left text-xs text-stone transition-colors hover:text-mango"
          >
            Sign out
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto px-8 py-8 sm:px-12 sm:py-10">
        <div className="mx-auto max-w-5xl">{children}</div>
      </main>
    </div>
  );
}
