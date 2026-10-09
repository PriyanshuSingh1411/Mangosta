"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";
import Navigation from "@/app/components/Navigation";
import EngagementTracker from "@/app/components/EngagementTracker";
import ProductCard from "@/app/components/ProductCard";
import { formatPrice } from "@/app/data/productTypes";
import type { Product } from "@/app/data/productTypes";
import { useAuth } from "@/app/components/AuthProvider";
import { useToast } from "@/app/components/ToastProvider";
import { Skeleton } from "@/app/components/Skeleton";
import DeleteAccount from "./DeleteAccount";

type Profile = {
  firstName: string;
  lastName: string;
  email: string;
  mobile: string;
  dateOfBirth?: string;
  gender?: string;
  preferences?: {
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
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [contactOtp, setContactOtp] = useState<{ channel: "email"; value: string } | null>(null);
  const [contactCode, setContactCode] = useState("");
  const [contactBusy, setContactBusy] = useState(false);
  const [verifiedEmail, setVerifiedEmail] = useState("");
  // The marketing box as loaded, so a save only changes it when the
  // customer actually ticked / unticked it in this page.
  const loadedMarketing = useRef(false);
  const [addressOpen, setAddressOpen] = useState(false);
  const [address, setAddress] = useState(emptyAddress);

  // Loads everything on the page once the customer is known.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    const load = async () => {
      try {
        const [summaryResponse, profileResponse, wishlistResponse, addressResponse, productsResponse] =
          await Promise.all([
            fetch("/api/account/summary", { cache: "no-store" }),
            fetch("/api/account/profile", { cache: "no-store" }),
            fetch("/api/wishlist", { cache: "no-store" }),
            fetch("/api/account/addresses", { cache: "no-store" }),
            fetch("/api/products", { cache: "no-store" }),
          ]);

        const [summaryJson, profileJson, wishlistJson, addressJson, productsJson] =
          await Promise.all([
            summaryResponse.json().catch(() => null),
            profileResponse.json().catch(() => null),
            wishlistResponse.json().catch(() => null),
            addressResponse.json().catch(() => null),
            productsResponse.json().catch(() => []),
          ]);

        if (cancelled) return;

        setSummary(summaryJson);
        setProfile(profileJson?.profile ?? null);
        setVerifiedEmail(String(profileJson?.profile?.email ?? "").trim().toLowerCase());
        loadedMarketing.current = profileJson?.profile?.preferences?.marketingEmails === true;
        setWishlistIds(wishlistJson?.productIds ?? []);
        setAddresses(addressJson?.addresses ?? []);
        setProducts(Array.isArray(productsJson) ? productsJson : []);

        try {
          const stored = localStorage.getItem("mangosta-recently-viewed");
          setRecentIds(stored ? JSON.parse(stored) : []);
        } catch {
          setRecentIds([]);
        }
      } catch {
        if (!cancelled) toast("Could not load your account", "error");
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [user, toast]);

  const requestContactOtp = async () => {
    if (!profile) return;
    const value = profile.email.trim().toLowerCase();
    setContactBusy(true);
    try {
      const response = await fetch("/api/account/contact-verification", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "send", channel: "email", value }),
      });
      const json = await response.json().catch(() => null);
      if (!response.ok) { toast(json?.error || "Could not send verification code.", "error"); return; }
      setContactOtp({ channel: "email", value });
      setContactCode("");
      toast(json?.message || "Verification code sent.", "success");
    } catch { toast("Could not send verification code. Please try again.", "error"); }
    finally { setContactBusy(false); }
  };

  const verifyContactOtp = async () => {
    if (!contactOtp || !profile) return;
    setContactBusy(true);
    try {
      const response = await fetch("/api/account/contact-verification", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "verify", channel: "email", value: contactOtp.value, otp: contactCode }),
      });
      const json = await response.json().catch(() => null);
      if (!response.ok) { toast(json?.error || "Could not verify code.", "error"); return; }
      setProfile({ ...profile, email: json.value });
      setVerifiedEmail(String(json.value).trim().toLowerCase());
      setContactOtp(null);
      setContactCode("");
      toast(json?.message || "Contact detail verified.", "success");
    } catch { toast("Could not verify code. Please try again.", "error"); }
    finally { setContactBusy(false); }
  };

  const saveProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!profile) return;
    if (profile.email.trim().toLowerCase() !== verifiedEmail) {
      toast("Please verify your new email address before saving your profile.", "error");
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/account/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...profile,
          preferences: {
            ...profile.preferences,
            marketingEmailsWas: loadedMarketing.current,
          },
        }),
      });
      const json = await response.json().catch(() => null);

      if (!response.ok) {
        toast(json?.error || "Could not update profile", "error");
        return;
      }

      setProfile(json.profile);
      loadedMarketing.current = json.profile?.preferences?.marketingEmails === true;
      setEditing(false);
      toast("Profile updated", "success");
    } finally {
      setSaving(false);
    }
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



  if (authLoading) {
    return (
      <>
        <Navigation />
        <main className="min-h-screen bg-void px-5 pb-24 pt-28 sm:px-8 sm:pt-32 lg:px-12">
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
            <h1 className="mt-4 type-title text-bone">YOUR SPACE.</h1>
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
        <main className="min-h-screen bg-void px-5 pb-24 pt-28 sm:px-8 sm:pt-32 lg:px-12">
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

  const addressFields = ["name", "phone", "line1", "line2", "city", "state", "pincode"] as const;

  return (
    <>
      <EngagementTracker event="page_view" path="/account" />
      <Navigation />
      <main
        id="main-content"
        className="min-h-screen bg-void px-5 pb-24 pt-28 sm:px-8 sm:pt-32 lg:px-12"
      >
        <div className="mx-auto max-w-6xl">
          <header className="flex flex-wrap items-end justify-between gap-5 border-b border-line pb-8">
            <div className="min-w-0">
              <p className="label-technical mb-4">MANGOSTA / MY ACCOUNT</p>
              <div className="flex min-w-0 items-center gap-4">
                {/* Initials circle (profile photos are not uploaded) */}
                <div
                  aria-hidden="true"
                  className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-line-strong bg-charcoal font-display text-lg text-bone sm:h-16 sm:w-16 sm:text-xl"
                >
                  {(profile.firstName?.[0] ?? "").toUpperCase()}
                  {(profile.lastName?.[0] ?? "").toUpperCase()}
                </div>
                <div className="min-w-0">
                  <h1 className="type-title text-bone">
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
                <p className="mt-2 type-heading text-bone">{value}</p>
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
                <div className="text-xs text-stone">
                  <label htmlFor="profile-email">EMAIL</label>
                  <div className="mt-2 flex border border-line-strong focus-within:border-mango">
                    <input id="profile-email" type="email" value={profile.email}
                      onChange={(event) => { setProfile({ ...profile, email: event.target.value }); if (contactOtp?.channel === "email") setContactOtp(null); }}
                      className="min-w-0 flex-1 bg-transparent px-3 py-3 text-sm text-bone outline-none" required />
                    <button type="button" onClick={() => void requestContactOtp()} disabled={contactBusy || !profile.email.trim()}
                      className="border-l border-line-strong px-4 text-[10px] font-semibold tracking-[0.16em] text-bone hover:bg-mango hover:text-void disabled:opacity-50">VERIFY</button>
                  </div>
                  {contactOtp?.channel === "email" && <div className="mt-2 flex gap-2">
                    <input aria-label="Email verification code" inputMode="numeric" maxLength={6} value={contactCode} onChange={(event) => setContactCode(event.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="6-digit OTP" className="min-w-0 flex-1 border border-line-strong bg-transparent px-3 py-2 text-sm text-bone" />
                    <button type="button" onClick={() => void verifyContactOtp()} disabled={contactBusy || contactCode.length !== 6} className="bg-bone px-4 py-2 text-[10px] font-semibold tracking-widest text-void disabled:opacity-50">CONFIRM</button>
                  </div>}
                </div>
                <label className="text-xs text-stone">
                  MOBILE
                  <input
                    id="profile-mobile"
                    type="tel"
                    value={profile.mobile}
                    onChange={(event) => setProfile({ ...profile, mobile: event.target.value })}
                    placeholder="10-digit mobile number"
                    className="mt-2 w-full border border-line-strong bg-transparent px-3 py-3 text-sm text-bone"
                    required
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
                <div className="grid gap-3 border-t border-line pt-4 sm:col-span-2">
                  <label className="flex items-start gap-3 text-xs text-stone">
                    <input
                      type="checkbox"
                      checked={profile.preferences?.marketingEmails === true}
                      onChange={(event) =>
                        setProfile({
                          ...profile,
                          preferences: {
                            ...profile.preferences,
                            marketingEmails: event.target.checked,
                          },
                        })
                      }
                      className="mt-0.5 h-4 w-4 shrink-0 accent-[color:var(--color-mango)]"
                    />
                    <span>
                      New drops &amp; editorial updates
                      <span className="mt-0.5 block text-stone-dark">
                        Includes reminders about items left in your bag. Unsubscribe any time.
                      </span>
                    </span>
                  </label>
                  <p className="text-xs text-stone-dark">
                    Order, delivery and sign-in emails are always sent.
                  </p>
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

          <div className="mt-10 grid gap-8 lg:grid-cols-1">
            <section className="min-w-0 border border-line bg-charcoal p-5 sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
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
                      className="w-full min-w-0 border border-line-strong bg-transparent px-3 py-3 text-xs text-bone placeholder:text-stone-dark"
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
                        <p className="type-price text-sm text-bone">{formatPrice(order.total)}</p>
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
                {recentIds.slice(0, 4).map((id) => {
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
                {wishlistIds.slice(0, 4).map((id) => {
                  const product = products.find((item) => item.id === id);
                  return product ? <ProductCard key={id} product={product}/> : null;
                })}
              </div>
            </section>
          )}

          <DeleteAccount email={profile.email} />
        </div>
      </main>
    </>
  );
}
