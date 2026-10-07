"use client";

import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import Navigation from "@/app/components/Navigation";
import EngagementTracker from "@/app/components/EngagementTracker";
import ProductCard from "@/app/components/ProductCard";
import { formatPrice } from "@/app/data/productTypes";
import type { Product } from "@/app/data/productTypes";
import { useAuth } from "@/app/components/AuthProvider";
import { useToast } from "@/app/components/ToastProvider";
import { Skeleton } from "@/app/components/Skeleton";

type Profile = {
  firstName: string;
  lastName: string;
  email: string;
  mobile: string;
  dateOfBirth?: string;
  gender?: string;
  profilePhoto?: string;
  preferences?: {
    emailNotifications?: boolean;
    marketingEmails?: boolean;
  };
};

type Address = {
  id: string;
  name: string;
  phone: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  pincode: string;
};

type Summary = {
  user: { firstName: string; lastName: string };
  stats: { orders: number; wishlist: number; reviews: number; openTickets: number };
  recentOrders: {
    id: string;
    lines: { productId: string }[];
    total: number;
    status: string;
  }[];
};

const emptyAddress = {
  name: "",
  phone: "",
  line1: "",
  line2: "",
  city: "",
  state: "",
  pincode: "",
};

export default function AccountPage() {
  const { user, loading: authLoading, openAuth } = useAuth();
  const { toast } = useToast();

  const [summary, setSummary] = useState<Summary | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [recentIds, setRecentIds] = useState<string[]>([]);
  const [wishlistIds, setWishlistIds] = useState<string[]>([]);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [sizeProfile, setSizeProfile] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [addressOpen, setAddressOpen] = useState(false);
  const [address, setAddress] = useState(emptyAddress);

  const load = async () => {
    if (!user) return;

    try {
      const [summaryResponse, profileResponse, wishlistResponse, addressResponse, sizeResponse, productsResponse] =
        await Promise.all([
          fetch("/api/account/summary", { cache: "no-store" }),
          fetch("/api/account/profile", { cache: "no-store" }),
          fetch("/api/wishlist", { cache: "no-store" }),
          fetch("/api/account/addresses", { cache: "no-store" }),
          fetch("/api/account/size-profile", { cache: "no-store" }),
          fetch("/api/products", { cache: "no-store" }),
        ]);

      const [summaryJson, profileJson, wishlistJson, addressJson, sizeJson, productsJson] =
        await Promise.all([
          summaryResponse.json().catch(() => null),
          profileResponse.json().catch(() => null),
          wishlistResponse.json().catch(() => null),
          addressResponse.json().catch(() => null),
          sizeResponse.json().catch(() => null),
          productsResponse.json().catch(() => []),
        ]);

      setSummary(summaryJson);
      setProfile(profileJson?.profile ?? null);
      setWishlistIds(wishlistJson?.productIds ?? []);
      setAddresses(addressJson?.addresses ?? []);
      setSizeProfile(sizeJson?.sizeProfile ?? {});
      setProducts(Array.isArray(productsJson) ? productsJson : []);

      try {
        const stored = localStorage.getItem("mangosta-recently-viewed");
        setRecentIds(stored ? JSON.parse(stored) : []);
      } catch {
        setRecentIds([]);
      }
    } catch {
      toast("Could not load your account", "error");
    }
  };

  useEffect(() => {
    if (user) void load();
  }, [user]);

  const saveProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!profile) return;

    setSaving(true);
    try {
      const response = await fetch("/api/account/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile),
      });
      const json = await response.json().catch(() => null);

      if (!response.ok) {
        toast(json?.error || "Could not update profile", "error");
        return;
      }

      setProfile(json.profile);
      setEditing(false);
      toast("Profile updated", "success");
    } finally {
      setSaving(false);
    }
  };

  const uploadPhoto = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !profile) return;

    if (file.size > 900 * 1024) {
      toast("Choose a profile photo under 900 KB", "error");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setProfile((current) =>
        current ? { ...current, profilePhoto: String(reader.result || "") } : current,
      );
    };
    reader.readAsDataURL(file);
  };

  const addAddress = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const response = await fetch("/api/account/addresses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(address),
    });
    const json = await response.json().catch(() => null);

    if (!response.ok) {
      toast(json?.error || "Could not save address", "error");
      return;
    }

    setAddresses((current) => [json.address, ...current]);
    setAddress(emptyAddress);
    setAddressOpen(false);
    toast("Address saved", "success");
  };

  const deleteAddress = async (id: string) => {
    const response = await fetch(`/api/account/addresses?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    });

    if (response.ok) {
      setAddresses((current) => current.filter((item) => item.id !== id));
      toast("Address removed", "success");
    }
  };

  const saveSize = async () => {
    const response = await fetch("/api/account/size-profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(sizeProfile),
    });

    toast(
      response.ok ? "Size profile saved" : "Could not save size profile",
      response.ok ? "success" : "error",
    );
  };

  if (authLoading) {
    return (
      <>
        <Navigation />
        <main className="min-h-screen bg-void px-5 pt-32 sm:px-8 sm:pt-40">
          <div className="mx-auto max-w-6xl">
            <Skeleton className="h-3 w-32" />
            <Skeleton className="mt-5 h-14 w-80" />
          </div>
        </main>
      </>
    );
  }

  if (!user) {
    return (
      <>
        <Navigation />
        <main
          id="main-content"
          className="flex min-h-screen items-center justify-center bg-void px-6 pt-20 text-center"
        >
          <div>
            <p className="label-technical">MANGOSTA / ACCOUNT</p>
            <h1 className="mt-4 font-display text-5xl text-bone">YOUR SPACE.</h1>
            <p className="mt-4 text-sm text-stone">
              Sign in to manage your profile, orders, wishlist and preferences.
            </p>
            <button
              onClick={() => openAuth("signin")}
              className="mt-7 bg-bone px-7 py-3 text-xs tracking-[0.16em] text-void hover:bg-mango"
            >
              SIGN IN
            </button>
          </div>
        </main>
      </>
    );
  }

  if (!profile || !summary) {
    return (
      <>
        <Navigation />
        <main className="min-h-screen bg-void px-5 pt-32 sm:px-8 sm:pt-40">
          <div className="mx-auto max-w-6xl">
            <Skeleton className="h-14 w-80" />
            <div className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <Skeleton key={index} className="h-28" />
              ))}
            </div>
          </div>
        </main>
      </>
    );
  }

  const stats = [
    ["ORDERS", summary.stats.orders],
    ["WISHLIST", summary.stats.wishlist],
    ["REVIEWS", summary.stats.reviews],
    ["OPEN SUPPORT", summary.stats.openTickets],
  ] as const;

  const accountLinks = [
    ["MY ORDERS", "/orders"],
    ["WISHLIST", "/wishlist"],
    ["MY REVIEWS", "/account/reviews"],
    ["NOTIFICATIONS", "/notifications"],
    ["HELP & SUPPORT", "/support"],
  ] as const;

  const sizeFields = ["height", "weight", "chest", "waist", "usualSize", "fit"] as const;
  const addressFields = ["name", "phone", "line1", "line2", "city", "state", "pincode"] as const;

  return (
    <>
      <EngagementTracker event="page_view" path="/account" />
      <Navigation />
      <main
        id="main-content"
        className="min-h-screen bg-void px-5 pb-28 pt-32 sm:px-8 sm:pt-40"
      >
        <div className="mx-auto max-w-6xl">
          <header className="flex flex-wrap items-end justify-between gap-5 border-b border-line pb-8">
            <div>
              <p className="label-technical mb-4">MANGOSTA / MY ACCOUNT</p>
              <div className="flex items-center gap-4">
                <div className="relative h-16 w-16 overflow-hidden rounded-full border border-line-strong bg-charcoal">
                  {profile.profilePhoto ? (
                    <img src={profile.profilePhoto} alt="Profile" className="h-full w-full object-cover" />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center font-display text-xl text-bone">
                      {profile.firstName?.[0]}
                      {profile.lastName?.[0]}
                    </span>
                  )}
                </div>
                <div>
                  <h1 className="font-display text-5xl tracking-tight text-bone sm:text-7xl">
                    WELCOME BACK, {profile.firstName.toUpperCase()}
                  </h1>
                  <p className="mt-2 text-sm text-stone">Everything Mangosta, in one place.</p>
                </div>
              </div>
            </div>
            <Link
              href="/notifications"
              className="border border-line-strong px-5 py-3 text-[10px] tracking-[0.16em] text-bone hover:border-bone"
            >
              NOTIFICATIONS
            </Link>
          </header>

          <div className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {stats.map(([label, value]) => (
              <div key={label} className="border border-line bg-charcoal p-5">
                <p className="label-technical text-stone">{label}</p>
                <p className="mt-2 font-display text-3xl text-bone">{value}</p>
              </div>
            ))}
          </div>

          <section className="mt-10 border border-line bg-charcoal p-6 sm:p-8">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="label-technical">PROFILE</p>
                <p className="mt-2 text-sm text-stone">Your personal details.</p>
              </div>
              <button
                onClick={() => setEditing((value) => !value)}
                className="text-xs text-bone underline underline-offset-4"
              >
                {editing ? "CANCEL" : "EDIT PROFILE"}
              </button>
            </div>

            {editing ? (
              <form onSubmit={saveProfile} className="mt-6 grid gap-4 sm:grid-cols-2">
                <label className="text-xs text-stone">
                  FIRST NAME
                  <input
                    value={profile.firstName}
                    onChange={(event) => setProfile({ ...profile, firstName: event.target.value })}
                    className="mt-2 w-full border border-line-strong bg-transparent px-3 py-3 text-sm text-bone"
                    required
                  />
                </label>
                <label className="text-xs text-stone">
                  LAST NAME
                  <input
                    value={profile.lastName}
                    onChange={(event) => setProfile({ ...profile, lastName: event.target.value })}
                    className="mt-2 w-full border border-line-strong bg-transparent px-3 py-3 text-sm text-bone"
                    required
                  />
                </label>
                <label className="text-xs text-stone">
                  EMAIL
                  <input
                    value={profile.email}
                    disabled
                    className="mt-2 w-full border border-line bg-black/10 px-3 py-3 text-sm text-stone"
                  />
                </label>
                <label className="text-xs text-stone">
                  MOBILE
                  <input
                    value={profile.mobile}
                    disabled
                    className="mt-2 w-full border border-line bg-black/10 px-3 py-3 text-sm text-stone"
                  />
                </label>
                <label className="text-xs text-stone">
                  DATE OF BIRTH
                  <input
                    type="date"
                    value={profile.dateOfBirth || ""}
                    onChange={(event) => setProfile({ ...profile, dateOfBirth: event.target.value })}
                    className="mt-2 w-full border border-line-strong bg-transparent px-3 py-3 text-sm text-bone"
                  />
                </label>
                <label className="text-xs text-stone">
                  GENDER / PREFERENCE
                  <select
                    value={profile.gender || ""}
                    onChange={(event) => setProfile({ ...profile, gender: event.target.value })}
                    className="mt-2 w-full border border-line-strong bg-charcoal px-3 py-3 text-sm text-bone"
                  >
                    <option value="">Prefer not to say</option>
                    <option>Woman</option>
                    <option>Man</option>
                    <option>Non-binary</option>
                    <option>Other</option>
                  </select>
                </label>
                <label className="text-xs text-stone sm:col-span-2">
                  PROFILE PHOTO
                  <input
                    type="file"
                    accept="image/*"
                    onChange={uploadPhoto}
                    className="mt-2 block w-full text-xs text-stone"
                  />
                </label>
                <div className="grid gap-3 border-t border-line pt-4 sm:col-span-2 sm:grid-cols-2">
                  <label className="flex items-center gap-3 text-xs text-stone">
                    <input
                      type="checkbox"
                      checked={Boolean(profile.preferences?.emailNotifications)}
                      onChange={(event) =>
                        setProfile({
                          ...profile,
                          preferences: {
                            ...profile.preferences,
                            emailNotifications: event.target.checked,
                          },
                        })
                      }
                      className="h-4 w-4 accent-[color:var(--color-mango)]"
                    />
                    Order &amp; account emails
                  </label>
                  <label className="flex items-center gap-3 text-xs text-stone">
                    <input
                      type="checkbox"
                      checked={Boolean(profile.preferences?.marketingEmails)}
                      onChange={(event) =>
                        setProfile({
                          ...profile,
                          preferences: {
                            ...profile.preferences,
                            marketingEmails: event.target.checked,
                          },
                        })
                      }
                      className="h-4 w-4 accent-[color:var(--color-mango)]"
                    />
                    New drops &amp; editorial updates
                  </label>
                </div>
                <div className="sm:col-span-2">
                  <button
                    disabled={saving}
                    className="bg-bone px-6 py-3 text-xs tracking-[0.16em] text-void hover:bg-mango disabled:opacity-50"
                  >
                    {saving ? "SAVING…" : "SAVE PROFILE"}
                  </button>
                </div>
              </form>
            ) : (
              <div className="mt-6 grid gap-5 sm:grid-cols-3">
                <div>
                  <p className="label-technical text-stone">NAME</p>
                  <p className="mt-2 text-sm text-bone">{profile.firstName} {profile.lastName}</p>
                </div>
                <div>
                  <p className="label-technical text-stone">EMAIL</p>
                  <p className="mt-2 text-sm text-bone">{profile.email}</p>
                </div>
                <div>
                  <p className="label-technical text-stone">MOBILE</p>
                  <p className="mt-2 text-sm text-bone">{profile.mobile || "—"}</p>
                </div>
              </div>
            )}
          </section>

          <div className="mt-10 grid gap-8 lg:grid-cols-2">
            <section className="border border-line bg-charcoal p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="label-technical">SAVED ADDRESSES</p>
                  <p className="mt-2 text-sm text-stone">Delivery addresses for faster checkout.</p>
                </div>
                <button
                  onClick={() => setAddressOpen((value) => !value)}
                  className="border border-line-strong px-4 py-2 text-[10px] tracking-[0.15em] text-bone hover:border-bone"
                >
                  {addressOpen ? "CLOSE" : "ADD ADDRESS"}
                </button>
              </div>

              {addressOpen && (
                <form onSubmit={addAddress} className="mt-5 grid gap-3 sm:grid-cols-2">
                  {addressFields.map((field) => (
                    <input
                      key={field}
                      required={field !== "line2"}
                      placeholder={field.replace(/([A-Z])/g, " $1").toUpperCase()}
                      value={address[field]}
                      onChange={(event) => setAddress({ ...address, [field]: event.target.value })}
                      className="border border-line-strong bg-transparent px-3 py-3 text-xs text-bone placeholder:text-stone-dark"
                    />
                  ))}
                  <button className="bg-bone px-5 py-3 text-xs tracking-[0.14em] text-void sm:col-span-2">
                    SAVE ADDRESS
                  </button>
                </form>
              )}

              {addresses.length === 0 && !addressOpen ? (
                <p className="py-10 text-sm text-stone">No saved addresses yet.</p>
              ) : (
                <div className="mt-5 space-y-3">
                  {addresses.map((item) => (
                    <div key={item.id} className="border border-line-strong p-4">
                      <div className="flex justify-between gap-4">
                        <p className="text-sm font-medium text-bone">{item.name}</p>
                        <button
                          onClick={() => deleteAddress(item.id)}
                          className="text-[10px] text-stone hover:text-mango"
                        >
                          REMOVE
                        </button>
                      </div>
                      <p className="mt-2 text-xs leading-5 text-stone">
                        {item.line1}{item.line2 ? `, ${item.line2}` : ""}
                        <br />
                        {item.city}, {item.state} — {item.pincode}
                        <br />
                        {item.phone}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="border border-line bg-charcoal p-6">
              <p className="label-technical">SIZE PROFILE</p>
              <p className="mt-2 text-sm text-stone">Save your fit preferences for faster size decisions.</p>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {sizeFields.map((field) => (
                  <input
                    key={field}
                    placeholder={field.replace(/([A-Z])/g, " $1").toUpperCase()}
                    value={sizeProfile[field] || ""}
                    onChange={(event) => setSizeProfile({ ...sizeProfile, [field]: event.target.value })}
                    className="border border-line-strong bg-transparent px-3 py-3 text-xs text-bone placeholder:text-stone-dark"
                  />
                ))}
              </div>
              <button
                onClick={saveSize}
                className="mt-4 bg-bone px-5 py-3 text-xs tracking-[0.14em] text-void hover:bg-mango"
              >
                SAVE SIZE PROFILE
              </button>
            </section>
          </div>

          <div className="mt-10 grid gap-8 lg:grid-cols-[1.2fr_.8fr]">
            <section className="border border-line bg-charcoal p-6">
              <div className="flex items-center justify-between">
                <p className="label-technical">RECENT ORDERS</p>
                <Link href="/orders" className="text-xs text-stone underline">VIEW ALL</Link>
              </div>

              {summary.recentOrders.length === 0 ? (
                <p className="py-10 text-sm text-stone">No orders yet.</p>
              ) : (
                <div className="mt-4 divide-y divide-line">
                  {summary.recentOrders.map((order) => (
                    <Link
                      key={order.id}
                      href={`/orders/${order.id}`}
                      className="flex items-center justify-between gap-4 py-4"
                    >
                      <div>
                        <p className="font-mono text-xs text-mango">{order.id}</p>
                        <p className="mt-1 text-sm text-bone">
                          {order.lines.length} {order.lines.length === 1 ? "item" : "items"}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-mono text-sm text-bone">{formatPrice(order.total)}</p>
                        <p className="mt-1 text-[10px] text-stone">{order.status.toUpperCase()}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </section>

            <section className="border border-line bg-charcoal p-6">
              <p className="label-technical">MY ACCOUNT</p>
              <div className="mt-5 grid gap-2">
                {accountLinks.map(([label, href]) => (
                  <Link
                    key={href}
                    href={href}
                    className="border border-line-strong px-4 py-4 text-xs tracking-[0.15em] text-bone hover:border-bone"
                  >
                    {label} →
                  </Link>
                ))}
              </div>
            </section>
          </div>

          {recentIds.length > 0 && products.length > 0 && (
            <section className="mt-12">
              <p className="label-technical">RECENTLY VIEWED</p>
              <p className="mt-2 text-sm text-stone">Pick up where you left off.</p>
              <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
                {recentIds.slice(0, 4).map((id, index) => {
                  const product = products.find((item) => item.id === id);
                  return product ? <ProductCard key={id} product={product}/> : null;
                })}
              </div>
            </section>
          )}

          {wishlistIds.length > 0 && products.length > 0 && (
            <section className="mt-12">
              <div className="flex items-center justify-between">
                <div>
                  <p className="label-technical">YOUR WISHLIST</p>
                  <p className="mt-2 text-sm text-stone">Saved pieces waiting for you.</p>
                </div>
                <Link href="/wishlist" className="text-xs text-stone hover:text-bone">
                  VIEW WISHLIST →
                </Link>
              </div>
              <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
                {wishlistIds.slice(0, 4).map((id, index) => {
                  const product = products.find((item) => item.id === id);
                  return product ? <ProductCard key={id} product={product}/> : null;
                })}
              </div>
            </section>
          )}
        </div>
      </main>
    </>
  );
}
