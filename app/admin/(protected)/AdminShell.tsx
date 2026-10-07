"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";

const NAV_ITEMS = [
  { label: "Dashboard", href: "/admin" },
  { label: "Products", href: "/admin/products" },
  { label: "Orders", href: "/admin/orders" },
  { label: "Returns", href: "/admin/returns" },
  { label: "Reviews", href: "/admin/reviews" },
  { label: "Support", href: "/admin/support" },
  { label: "Questions", href: "/admin/questions" },
  { label: "Settings", href: "/admin/settings" },
  { label: "Size Guide", href: "/admin/size-guide" },
  { label: "Delivery", href: "/admin/delivery" },
  { label: "Email", href: "/admin/email" },
  { label: "Reminders", href: "/admin/reminders" },
  { label: "Checkout", href: "/admin/checkout" },
  { label: "Coupons", href: "/admin/coupons" },
];

const USER_NAV_ITEMS = [
  { label: "User Engagement", href: "/admin/user-engagement" },
  { label: "Feature Usage", href: "/admin/user-engagement/feature-usage" },
  { label: "Customer Profiles", href: "/admin/user-engagement/customer-profiles" },
  { label: "Customer Segments", href: "/admin/user-engagement/customer-segments" },
  { label: "Retention", href: "/admin/user-engagement/retention" },
  { label: "Customer LTV", href: "/admin/user-engagement/ltv" },
  { label: "Search Analytics", href: "/admin/user-engagement/search" },
  { label: "Product Discovery", href: "/admin/user-engagement/product-discovery" },
];

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const isUserRoute = pathname === "/admin/user-engagement" || pathname.startsWith("/admin/user-engagement/");
  const [userExpanded, setUserExpanded] = useState(isUserRoute);

  const handleLogout = async () => {
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/admin/login");
    router.refresh();
  };

  const isActive = (href: string) =>
    href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);

  const activeItem = NAV_ITEMS.find((item) => isActive(item.href)) ?? USER_NAV_ITEMS.find((item) => isActive(item.href));

  // Close the drawer whenever the route changes and keep User expanded for every User page.
  useEffect(() => {
    setMenuOpen(false);
    if (isUserRoute) setUserExpanded(true);
  }, [pathname, isUserRoute]);

  // While the drawer is open on a phone: lock page scroll and let Escape close it.
  useEffect(() => {
    if (!menuOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  // If the window grows to desktop width, make sure the drawer state resets.
  useEffect(() => {
    const query = window.matchMedia("(min-width: 1024px)");
    const onChange = () => {
      if (query.matches) setMenuOpen(false);
    };
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  return (
    <div className="min-h-[100svh] bg-void text-bone lg:flex">
      {/* ------------------------------------------------------------
          Phone / tablet top bar
          ------------------------------------------------------------ */}
      <header className="sticky top-0 z-40 flex h-14 items-center justify-between gap-3 border-b border-line bg-void/95 px-4 backdrop-blur sm:px-6 lg:hidden">
        <Link href="/admin" className="flex min-w-0 items-center gap-2.5">
          <div className="relative h-6 w-9 shrink-0">
            <Image src="/images/mark-white.png" alt="" fill sizes="36px" className="object-contain" />
          </div>
          <span className="font-display text-base tracking-tight">MANGOSTA</span>
        </Link>

        <div className="flex min-w-0 items-center gap-3">
          {activeItem && (
            <span className="label-technical hidden truncate min-[420px]:block">
              {activeItem.label}
            </span>
          )}
          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            aria-controls="admin-nav"
            className="-mr-2 flex h-11 w-11 shrink-0 flex-col items-center justify-center gap-[5px]"
          >
            <span
              className={`h-px w-6 bg-bone transition-transform duration-300 ${
                menuOpen ? "translate-y-[3px] rotate-45" : ""
              }`}
            />
            <span
              className={`h-px w-6 bg-bone transition-transform duration-300 ${
                menuOpen ? "-translate-y-[3px] -rotate-45" : ""
              }`}
            />
          </button>
        </div>
      </header>

      {/* Backdrop (phone / tablet only) */}
      <div
        onClick={() => setMenuOpen(false)}
        aria-hidden="true"
        className={`fixed inset-0 z-40 bg-black/70 transition-opacity duration-300 lg:hidden ${
          menuOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />

      {/* ------------------------------------------------------------
          Navigation: slide-in drawer below lg, fixed sidebar from lg up
          ------------------------------------------------------------ */}
      <aside
        id="admin-nav"
        data-lenis-prevent
        className={`fixed inset-y-0 left-0 z-50 flex w-64 max-w-[85vw] flex-col overflow-y-auto border-r border-line bg-void px-5 py-6 transition-[transform,visibility] duration-300 lg:sticky lg:top-0 lg:z-auto lg:h-[100svh] lg:w-60 lg:max-w-none lg:shrink-0 lg:translate-x-0 lg:self-start lg:visible ${
          menuOpen ? "translate-x-0" : "-translate-x-full invisible"
        }`}
      >
        <div className="mb-8 flex items-center justify-between lg:mb-10">
          <Link href="/admin" className="flex items-center gap-2.5">
            <div className="relative h-6 w-9">
              <Image src="/images/mark-white.png" alt="" fill sizes="36px" className="object-contain" />
            </div>
            <span className="font-display text-base tracking-tight">MANGOSTA</span>
          </Link>
          <button
            type="button"
            onClick={() => setMenuOpen(false)}
            aria-label="Close menu"
            className="-mr-2 flex h-10 w-10 items-center justify-center text-2xl leading-none text-stone transition-colors hover:text-bone lg:hidden"
          >
            &times;
          </button>
        </div>

        <nav className="flex flex-1 flex-col gap-1" aria-label="Admin">
          {NAV_ITEMS.slice(0, 3).map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive(item.href) ? "page" : undefined}
              className={`px-3 py-3 text-sm transition-colors lg:py-2.5 ${
                isActive(item.href)
                  ? "bg-charcoal-raised text-bone"
                  : "text-stone hover:bg-charcoal hover:text-bone-dim"
              }`}
            >
              {item.label}
            </Link>
          ))}

          <div className="mt-1">
            <button
              type="button"
              onClick={() => setUserExpanded((expanded) => !expanded)}
              aria-expanded={userExpanded}
              aria-controls="admin-user-nav"
              className={`flex w-full items-center justify-between px-3 py-3 text-left text-sm transition-colors lg:py-2.5 ${
                isUserRoute ? "bg-charcoal-raised text-bone" : "text-stone hover:bg-charcoal hover:text-bone-dim"
              }`}
            >
              <span>User</span>
              <span aria-hidden="true" className={`text-xs transition-transform ${userExpanded ? "rotate-180" : ""}`}>⌄</span>
            </button>

            <div
              id="admin-user-nav"
              className={`grid overflow-hidden transition-[grid-template-rows,opacity] duration-200 ${userExpanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}
            >
              <div className="min-h-0 overflow-hidden border-l border-line ml-3 pl-2">
                {USER_NAV_ITEMS.map((item) => {
                  const childActive = item.href === "/admin/user-engagement" ? pathname === item.href : pathname.startsWith(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      aria-current={childActive ? "page" : undefined}
                      className={`block px-3 py-2.5 text-xs transition-colors ${
                        childActive
                          ? "bg-charcoal-raised text-bone"
                          : "text-stone hover:bg-charcoal hover:text-bone-dim"
                      }`}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>

          {NAV_ITEMS.slice(3).map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive(item.href) ? "page" : undefined}
              className={`px-3 py-3 text-sm transition-colors lg:py-2.5 ${
                isActive(item.href)
                  ? "bg-charcoal-raised text-bone"
                  : "text-stone hover:bg-charcoal hover:text-bone-dim"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="mt-6 flex flex-col gap-2 border-t border-line pt-5">
          <Link
            href="/"
            target="_blank"
            className="px-3 py-2.5 text-xs text-stone transition-colors hover:text-bone-dim lg:py-2"
          >
            View storefront ↗
          </Link>
          <button
            type="button"
            onClick={handleLogout}
            className="px-3 py-2.5 text-left text-xs text-stone transition-colors hover:text-mango lg:py-2"
          >
            Sign out
          </button>
        </div>
      </aside>

      {/* ------------------------------------------------------------
          Page content
          min-w-0 is what stops wide children (tables, long URLs) from
          pushing the whole layout wider than the screen.
          ------------------------------------------------------------ */}
      <main className="min-w-0 flex-1 px-4 py-6 sm:px-8 sm:py-8 lg:px-12 lg:py-10">
        <div className="mx-auto w-full max-w-5xl">{children}</div>
      </main>
    </div>
  );
}
