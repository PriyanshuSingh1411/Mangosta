"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";

import Navigation from "@/app/components/Navigation";
import ProductPlaceholderArt from "@/app/components/ProductPlaceholderArt";
import { useCartStore } from "@/app/store/useCartStore";
import {
  formatPrice,
  getProductSalePrice,
  hasProductDiscount,
  getProductStrikethroughPrice,
} from "@/app/data/productTypes";
import { useCursorHover } from "@/app/lib/useCursorHover";
import { useAuth } from "@/app/components/AuthProvider";

type CheckoutSettings = {
  enabled: boolean;
  defaultShipping: number;
  freeShippingEnabled: boolean;
  freeShippingThreshold: number;
  rules: Array<{
    id: string;
    enabled: boolean;
    minOrderValue: number;
    shippingCost: number;
  }>;
};

const DEFAULT_CHECKOUT_SETTINGS: CheckoutSettings = {
  enabled: true,
  defaultShipping: 12,
  freeShippingEnabled: true,
  freeShippingThreshold: 10,
  rules: [],
};

type CheckoutCoupon = {
  code: string;
  discountType: "percentage" | "fixed";
  discountValue: number;
  minOrderValue: number;
  maxDiscount: number;
  startsAt?: string;
  expiresAt?: string;
};

type AppliedCoupon = CheckoutCoupon & {
  discount: number;
};

const INDIAN_STATES = [
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chhattisgarh",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Madhya Pradesh",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
  "Andaman and Nicobar Islands",
  "Chandigarh",
  "Dadra and Nagar Haveli and Daman and Diu",
  "Delhi",
  "Jammu and Kashmir",
  "Ladakh",
  "Lakshadweep",
  "Puducherry",
];

export default function CheckoutPage() {
  const { lines, subtotal } = useCartStore();
  const { user, loading: authLoading } = useAuth();

  const shopCursor = useCursorHover("shop", "SHOP");

  const [failedLines, setFailedLines] = useState<Set<string>>(
    new Set()
  );

  const [checkoutSettings, setCheckoutSettings] =
    useState<CheckoutSettings>(
      DEFAULT_CHECKOUT_SETTINGS
    );

  const [shippingLoading, setShippingLoading] =
    useState(true);

  const [submitError, setSubmitError] =
    useState<string | null>(null);

  const [couponCode, setCouponCode] = useState("");

  const [appliedCoupon, setAppliedCoupon] =
    useState<AppliedCoupon | null>(null);

  const [couponLoading, setCouponLoading] =
    useState(false);

  const [couponError, setCouponError] =
    useState<string | null>(null);

  const [availableCoupons, setAvailableCoupons] =
    useState<CheckoutCoupon[]>([]);

  const [couponsLoading, setCouponsLoading] =
    useState(true);

  const [form, setForm] = useState({
    email: "",
    firstName: "",
    lastName: "",
    mobile: "",
    address: "",
    city: "",
    state: "",
    postalCode: "",
  });

  useEffect(() => {
    void useCartStore.getState().syncProducts();
  }, []);

  const currentSubtotal = subtotal();

  // Calculate total product-level discounts (before coupon)
  const productDiscount = useMemo(() => {
    return lines.reduce((sum, line) => {
      const basePrice = line.product.price || 0;
      const discountPercent = Number(line.product.discountPercent) || 0;
      if (discountPercent > 0) {
        const lineDiscount = (basePrice * discountPercent / 100) * line.quantity;
        return sum + lineDiscount;
      }
      return sum;
    }, 0);
  }, [lines]);

  /*
   * --------------------------------------------------------------------------
   * Prefill logged-in customer
   * --------------------------------------------------------------------------
   */

  useEffect(() => {
    if (authLoading || !user) {
      return;
    }

    setForm((current) => ({
      ...current,
      email: user.email || current.email,
      firstName: user.firstName || current.firstName,
      lastName: user.lastName || current.lastName,
      mobile: user.mobile || current.mobile,
    }));
  }, [authLoading, user]);

  /*
   * --------------------------------------------------------------------------
   * Load checkout settings
   * --------------------------------------------------------------------------
   */

  useEffect(() => {
    let cancelled = false;

    async function loadCheckoutSettings() {
      try {
        setShippingLoading(true);

        // Settings only — shipping shown here is an estimate; the server
        // recalculates the real amount when the order is placed.
        const response = await fetch(
          "/api/checkout",
          {
            cache: "no-store",
          }
        );

        const data = await response
          .json()
          .catch(() => null);

        if (!response.ok) {
          throw new Error(
            data?.error ||
              "Failed to load checkout settings."
          );
        }

        if (!cancelled && data?.settings) {
          setCheckoutSettings({
            ...DEFAULT_CHECKOUT_SETTINGS,
            ...data.settings,
            rules: Array.isArray(data.settings.rules)
              ? data.settings.rules
              : [],
          });
        }
      } catch (error) {
        if (!cancelled) {
          setSubmitError(
            error instanceof Error
              ? error.message
              : "Failed to load checkout settings."
          );
        }
      } finally {
        if (!cancelled) {
          setShippingLoading(false);
        }
      }
    }

    loadCheckoutSettings();

    return () => {
      cancelled = true;
    };
  }, []);

  /*
   * --------------------------------------------------------------------------
   * Load available coupons
   * --------------------------------------------------------------------------
   */

  useEffect(() => {
    let cancelled = false;

    async function loadAvailableCoupons() {
      try {
        setCouponsLoading(true);

        const response = await fetch(
          `/api/checkout/coupon?subtotal=${encodeURIComponent(
            currentSubtotal
          )}`,
          {
            cache: "no-store",
          }
        );

        const data = await response
          .json()
          .catch(() => null);

        if (!response.ok) {
          throw new Error(
            data?.error ||
              "Failed to load available coupons."
          );
        }

        if (!cancelled) {
          const coupons = Array.isArray(data?.coupons)
            ? data.coupons
            : [];

          setAvailableCoupons(
            coupons.map(
              (coupon: CheckoutCoupon) => ({
                code: String(coupon.code || "")
                  .trim()
                  .toUpperCase(),

                discountType:
                  coupon.discountType === "fixed"
                    ? "fixed"
                    : "percentage",

                discountValue:
                  Number(coupon.discountValue) || 0,

                minOrderValue:
                  Number(coupon.minOrderValue) || 0,

                maxDiscount:
                  Number(coupon.maxDiscount) || 0,

                startsAt: coupon.startsAt || "",
                expiresAt: coupon.expiresAt || "",
              })
            )
          );
        }
      } catch {
        if (!cancelled) {
          setAvailableCoupons([]);
        }
      } finally {
        if (!cancelled) {
          setCouponsLoading(false);
        }
      }
    }

    loadAvailableCoupons();

    return () => {
      cancelled = true;
    };
  }, [currentSubtotal]);

  /*
   * --------------------------------------------------------------------------
   * Apply coupon
   * --------------------------------------------------------------------------
   */

  const applyCouponCode = async (code: string) => {
    const normalizedCode = code
      .trim()
      .toUpperCase()
      .replace(/\s+/g, "");

    if (!normalizedCode) {
      setCouponError("Enter a coupon code.");
      return;
    }

    setCouponCode(normalizedCode);
    setCouponError(null);
    setCouponLoading(true);

    try {
      const response = await fetch(
        "/api/checkout/coupon",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            code: normalizedCode,
            subtotal: currentSubtotal,
          }),
        }
      );

      const data = await response
        .json()
        .catch(() => null);

      if (!response.ok) {
        throw new Error(
          data?.error ||
            "Unable to apply coupon."
        );
      }

      if (!data?.coupon?.code) {
        throw new Error(
          "Invalid coupon response."
        );
      }

      const discount =
        Number(data.discount) || 0;

      if (discount <= 0) {
        throw new Error(
          "This coupon does not apply to this order."
        );
      }

      setAppliedCoupon({
        code: String(data.coupon.code)
          .trim()
          .toUpperCase(),

        discountType:
          data.coupon.discountType === "fixed"
            ? "fixed"
            : "percentage",

        discountValue:
          Number(data.coupon.discountValue) || 0,

        minOrderValue:
          Number(data.coupon.minOrderValue) || 0,

        maxDiscount:
          Number(data.coupon.maxDiscount) || 0,

        startsAt: data.coupon.startsAt || "",
        expiresAt: data.coupon.expiresAt || "",

        discount,
      });

      setCouponError(null);
    } catch (error) {
      setAppliedCoupon(null);

      setCouponError(
        error instanceof Error
          ? error.message
          : "Unable to apply coupon."
      );
    } finally {
      setCouponLoading(false);
    }
  };

  const removeCoupon = () => {
    setAppliedCoupon(null);
    setCouponCode("");
    setCouponError(null);
  };

  /*
   * --------------------------------------------------------------------------
   * Shipping
   * --------------------------------------------------------------------------
   */

  const shipping = (() => {
    if (
      lines.length === 0 ||
      !checkoutSettings.enabled
    ) {
      return 0;
    }

    if (
      checkoutSettings.freeShippingEnabled &&
      currentSubtotal >=
        checkoutSettings.freeShippingThreshold
    ) {
      return 0;
    }

    const matchingRule = [
      ...checkoutSettings.rules,
    ]
      .filter((rule) => rule.enabled)
      .sort(
        (a, b) =>
          b.minOrderValue -
          a.minOrderValue
      )
      .find(
        (rule) =>
          currentSubtotal >=
          rule.minOrderValue
      );

    return (
      matchingRule?.shippingCost ??
      checkoutSettings.defaultShipping
    );
  })();

  /*
   * --------------------------------------------------------------------------
   * Discount + total
   * --------------------------------------------------------------------------
   */

  const discount = Math.min(
    currentSubtotal,
    Math.max(
      0,
      Number(appliedCoupon?.discount || 0)
    )
  );

  const total =
    Math.max(
      0,
      currentSubtotal - discount
    ) + shipping;

  /*
   * --------------------------------------------------------------------------
   * Input helpers
   * --------------------------------------------------------------------------
   */

  const updateField =
    (key: keyof typeof form) =>
    (
      event: React.ChangeEvent<HTMLInputElement>
    ) => {
      setForm((current) => ({
        ...current,
        [key]: event.target.value,
      }));
    };

  const handleMobileChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const value = event.target.value
      .replace(/\D/g, "")
      .slice(0, 10);

    setForm((current) => ({
      ...current,
      mobile: value,
    }));
  };

  const handlePostalCodeChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const value = event.target.value
      .replace(/\D/g, "")
      .slice(0, 6);

    setForm((current) => ({
      ...current,
      postalCode: value,
    }));
  };

  /*
   * --------------------------------------------------------------------------
   * Continue to payment
   *
   * We do NOT create the order here.
   * We only save checkout information temporarily.
   * --------------------------------------------------------------------------
   */

  const handleContinueToPayment = (
    event: React.FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    setSubmitError(null);

    if (form.mobile.length !== 10) {
      setSubmitError(
        "Please enter a valid 10-digit mobile number."
      );
      return;
    }

    if (form.postalCode.length !== 6) {
      setSubmitError(
        "Please enter a valid 6-digit PIN code."
      );
      return;
    }

    if (!form.state) {
      setSubmitError(
        "Please select your state."
      );
      return;
    }

    try {
      const checkoutData = {
        customer: {
          email: form.email,
          firstName: form.firstName,
          lastName: form.lastName,
          mobile: form.mobile,
          address: form.address,
          city: form.city,
          state: form.state,
          postalCode: form.postalCode,
        },

        couponCode:
          appliedCoupon?.code || "",

        discount,

        shipping,

        total,
      };

      sessionStorage.setItem(
        "mangosta-checkout",
        JSON.stringify(checkoutData)
      );

      window.location.href =
        "/checkout/payment";
    } catch {
      setSubmitError(
        "Unable to continue. Please try again."
      );
    }
  };

  /*
   * --------------------------------------------------------------------------
   * Empty cart
   * --------------------------------------------------------------------------
   */

  if (lines.length === 0) {
    return (
      <>
        <Navigation />

        <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-void px-6 text-center">
          <p className="label-technical">
            CHECKOUT
          </p>

          <h1 className="font-display text-4xl tracking-tight text-bone">
            Your bag is empty.
          </h1>

          <Link
            href="/shop"
            {...shopCursor}
            className="border border-line-strong px-6 py-3 text-xs tracking-[0.15em] text-bone transition-colors hover:border-mango hover:text-mango"
          >
            SHOP NOW
          </Link>
        </main>
      </>
    );
  }

  /*
   * --------------------------------------------------------------------------
   * PAGE
   * --------------------------------------------------------------------------
   */

  return (
    <>
      <Navigation />

      <main className="min-h-screen bg-void px-6 pb-20 pt-28 sm:px-10 lg:px-12">
        <div className="mx-auto max-w-7xl">

          {/* HEADER */}

          <div className="mb-10">
            <p className="label-technical mb-3">
              CHECKOUT
            </p>

            <h1 className="font-display text-4xl tracking-tight text-bone sm:text-5xl">
              Complete your order.
            </h1>

            <p className="mt-3 text-sm text-stone">
              Enter your delivery details
              before continuing to payment.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-12 lg:grid-cols-[1.2fr_0.8fr] lg:gap-16">

            {/* ================================================================
               CUSTOMER FORM
               ================================================================ */}

            <form
              onSubmit={handleContinueToPayment}
              className="flex flex-col gap-10"
            >

              {/* CONTACT */}

              <fieldset>
                <legend className="label-technical mb-5">
                  CONTACT
                </legend>

                <div className="grid grid-cols-1 gap-4">

                  <input
                    required
                    type="email"
                    autoComplete="email"
                    placeholder="EMAIL"
                    value={form.email}
                    onChange={updateField("email")}
                    className="border border-line-strong bg-transparent px-4 py-4 text-sm text-bone placeholder:text-stone-dark focus:border-bone focus:outline-none"
                  />

                  <input
                    required
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel"
                    placeholder="MOBILE NUMBER"
                    value={form.mobile}
                    onChange={handleMobileChange}
                    maxLength={10}
                    className="border border-line-strong bg-transparent px-4 py-4 text-sm text-bone placeholder:text-stone-dark focus:border-bone focus:outline-none"
                  />

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">

                    <input
                      required
                      type="text"
                      autoComplete="given-name"
                      placeholder="FIRST NAME"
                      value={form.firstName}
                      onChange={updateField("firstName")}
                      className="border border-line-strong bg-transparent px-4 py-4 text-sm text-bone placeholder:text-stone-dark focus:border-bone focus:outline-none"
                    />

                    <input
                      required
                      type="text"
                      autoComplete="family-name"
                      placeholder="LAST NAME"
                      value={form.lastName}
                      onChange={updateField("lastName")}
                      className="border border-line-strong bg-transparent px-4 py-4 text-sm text-bone placeholder:text-stone-dark focus:border-bone focus:outline-none"
                    />

                  </div>

                </div>
              </fieldset>

              {/* SHIPPING ADDRESS */}

              <fieldset>
                <legend className="label-technical mb-5">
                  SHIPPING ADDRESS
                </legend>

                <div className="grid grid-cols-1 gap-4">

                  <input
                    required
                    type="text"
                    autoComplete="street-address"
                    placeholder="ADDRESS"
                    value={form.address}
                    onChange={updateField("address")}
                    className="border border-line-strong bg-transparent px-4 py-4 text-sm text-bone placeholder:text-stone-dark focus:border-bone focus:outline-none"
                  />

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">

                    <input
                      required
                      type="text"
                      autoComplete="address-level2"
                      placeholder="CITY"
                      value={form.city}
                      onChange={updateField("city")}
                      className="border border-line-strong bg-transparent px-4 py-4 text-sm text-bone placeholder:text-stone-dark focus:border-bone focus:outline-none"
                    />

                    <select
                      required
                      value={form.state}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          state: event.target.value,
                        }))
                      }
                      className="border border-line-strong bg-void px-4 py-4 text-sm text-bone focus:border-bone focus:outline-none"
                    >
                      <option value="" disabled>
                        SELECT STATE
                      </option>

                      {INDIAN_STATES.map((state) => (
                        <option
                          key={state}
                          value={state}
                          className="bg-void"
                        >
                          {state}
                        </option>
                      ))}
                    </select>

                  </div>

                  <input
                    required
                    type="text"
                    inputMode="numeric"
                    autoComplete="postal-code"
                    placeholder="PIN CODE"
                    value={form.postalCode}
                    onChange={handlePostalCodeChange}
                    maxLength={6}
                    className="border border-line-strong bg-transparent px-4 py-4 text-sm text-bone placeholder:text-stone-dark focus:border-bone focus:outline-none"
                  />

                </div>
              </fieldset>

              {/* ERROR */}

              {submitError && (
                <div className="border border-mango/40 bg-mango/5 px-4 py-3">
                  <p
                    role="alert"
                    className="text-sm text-mango"
                  >
                    {submitError}
                  </p>
                </div>
              )}

              {/* CONTINUE */}

              <button
                type="submit"
                disabled={shippingLoading}
                className="w-full bg-bone py-4 text-center text-xs font-medium tracking-[0.2em] text-void transition-colors hover:bg-mango disabled:cursor-not-allowed disabled:opacity-50"
              >
                {shippingLoading
                  ? "CALCULATING…"
                  : `CONTINUE TO PAYMENT — ${formatPrice(
                      total
                    )}`}
              </button>

            </form>

            {/* ================================================================
               ORDER SUMMARY
               ================================================================ */}

            <aside className="h-fit border border-line bg-charcoal p-6 sm:p-8">

              <p className="label-technical mb-6">
                ORDER SUMMARY
              </p>

              {/* PRODUCTS */}

              <ul className="flex flex-col gap-5">

                {lines.map((line) => (
                  <li
                    key={line.lineId}
                    className="flex gap-4"
                  >

                    <div className="relative h-20 w-16 shrink-0 overflow-hidden bg-void">

                      {line.product.images[0] &&
                      !failedLines.has(line.lineId) ? (
                        <Image
                          src={line.product.images[0]}
                          alt={line.product.name}
                          fill
                          sizes="64px"
                          className="object-cover"
                          onError={() =>
                            setFailedLines(
                              (previous) => {
                                const next =
                                  new Set(previous);

                                next.add(line.lineId);

                                return next;
                              }
                            )
                          }
                        />
                      ) : (
                        <ProductPlaceholderArt
                          seed={line.product.id}
                          className="h-full w-full"
                        />
                      )}

                    </div>

                    <div className="flex flex-1 flex-col justify-between">

                      <div>
                        <p className="text-sm text-bone">
                          {line.product.name}
                        </p>

                        <p className="mt-1 text-xs text-stone">
                          {line.color} / {line.size} ×{" "}
                          {line.quantity}
                        </p>
                      </div>

                      <div className="text-right">
                        {hasProductDiscount(line.product) && (
                          <>
                            {getProductStrikethroughPrice(line.product) !== null && (
                              <p className="font-mono text-[10px] text-stone-dark line-through">
                                {formatPrice((getProductStrikethroughPrice(line.product) ?? 0) * line.quantity)}
                              </p>
                            )}
                            <p className={`font-mono text-xs text-mango font-semibold`}>
                              {formatPrice(
                                getProductSalePrice(line.product) * line.quantity
                              )}
                            </p>
                            <p className="mt-1 text-[10px] tracking-wider text-mango bg-mango/10 px-1 py-0.5 rounded inline-block">
                              {Math.round(Number(line.product.discountPercent) || 0)}% OFF
                            </p>
                          </>
                        )}
                        {!hasProductDiscount(line.product) && (
                          <p className="font-mono text-xs text-bone-dim">
                            {formatPrice(
                              getProductSalePrice(line.product) * line.quantity
                            )}
                          </p>
                        )}
                      </div>

                    </div>

                  </li>
                ))}

              </ul>

              <div className="hairline my-6" />

              {/* COUPON */}

              <div className="mb-6">

                <p className="label-technical mb-3">
                  COUPON CODE
                </p>

                {appliedCoupon ? (
                  <div className="flex items-center justify-between border border-line-strong px-4 py-3">

                    <div>
                      <p className="font-mono text-xs text-bone">
                        {appliedCoupon.code}
                      </p>

                      <p className="mt-1 text-xs text-mango">
                        {appliedCoupon.discountType ===
                        "percentage"
                          ? `${appliedCoupon.discountValue}% OFF`
                          : `${formatPrice(
                              appliedCoupon.discountValue
                            )} OFF`}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={removeCoupon}
                      className="text-xs text-stone transition-colors hover:text-mango"
                    >
                      REMOVE
                    </button>

                  </div>
                ) : (
                  <div className="flex gap-2">

                    <input
                      type="text"
                      value={couponCode}
                      onChange={(event) => {
                        setCouponCode(
                          event.target.value
                            .toUpperCase()
                            .replace(/\s+/g, "")
                        );

                        setCouponError(null);
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          applyCouponCode(couponCode);
                        }
                      }}
                      placeholder="ENTER CODE"
                      className="min-w-0 flex-1 border border-line-strong bg-transparent px-4 py-3 text-sm text-bone placeholder:text-stone-dark focus:border-bone focus:outline-none"
                    />

                    <button
                      type="button"
                      onClick={() =>
                        applyCouponCode(couponCode)
                      }
                      disabled={couponLoading}
                      className="border border-line-strong px-4 py-3 text-xs tracking-[0.12em] text-bone transition-colors hover:border-mango hover:text-mango disabled:opacity-50"
                    >
                      {couponLoading
                        ? "CHECKING…"
                        : "APPLY"}
                    </button>

                  </div>
                )}

                {couponError && (
                  <p className="mt-2 text-xs text-mango">
                    {couponError}
                  </p>
                )}

                {!appliedCoupon &&
                  availableCoupons.length > 0 && (
                    <div className="mt-4">

                      <p className="mb-2 text-xs text-stone">
                        AVAILABLE COUPONS
                      </p>

                      <div className="flex flex-col gap-2">

                        {availableCoupons.map(
                          (coupon) => {
                            const eligible =
                              currentSubtotal >=
                              coupon.minOrderValue;

                            return (
                              <div
                                key={coupon.code}
                                className="flex items-center justify-between border border-line px-3 py-3"
                              >

                                <div>
                                  <p className="font-mono text-xs text-bone">
                                    {coupon.code}
                                  </p>

                                  <p className="mt-1 text-[11px] text-stone">
                                    {coupon.discountType ===
                                    "percentage"
                                      ? `${coupon.discountValue}% OFF`
                                      : `${formatPrice(
                                          coupon.discountValue
                                        )} OFF`}
                                  </p>
                                </div>

                                <button
                                  type="button"
                                  disabled={
                                    !eligible ||
                                    couponLoading
                                  }
                                  onClick={() =>
                                    applyCouponCode(
                                      coupon.code
                                    )
                                  }
                                  className="text-xs tracking-[0.1em] text-bone hover:text-mango disabled:text-stone-dark"
                                >
                                  {eligible
                                    ? "APPLY"
                                    : "NOT ELIGIBLE"}
                                </button>

                              </div>
                            );
                          }
                        )}

                      </div>

                    </div>
                  )}

                {couponsLoading &&
                  availableCoupons.length === 0 && (
                    <p className="mt-2 text-xs text-stone-dark">
                      Loading available coupons…
                    </p>
                  )}

              </div>

              {/* TOTALS */}

              <div className="flex flex-col gap-3 font-mono text-sm">

                <div className="flex justify-between text-stone">
                  <span>Subtotal</span>

                  <span>
                    {formatPrice(
                      currentSubtotal
                    )}
                  </span>
                </div>

                {productDiscount > 0 && (
                  <div className="flex justify-between text-mango border-b border-mango/20 pb-2">
                    <div className="flex flex-col gap-1">
                      <span className="text-sm font-semibold">Product Discounts</span>
                      <span className="text-xs text-mango/70">
                        {lines.filter(l => Number(l.product.discountPercent) > 0).length} item(s) with discount
                      </span>
                    </div>
                    <span className="text-sm font-semibold">
                      -{formatPrice(productDiscount)}
                    </span>
                  </div>
                )}

                {discount > 0 && (
                  <div className="flex justify-between text-mango">
                    <div className="flex flex-col gap-1">
                      <span>Coupon Discount</span>
                      {appliedCoupon && (
                        <span className="text-[11px] text-mango/70">
                          {appliedCoupon.code} ({appliedCoupon.discountType === "percentage" ? `${appliedCoupon.discountValue}%` : formatPrice(appliedCoupon.discountValue)})
                        </span>
                      )}
                    </div>

                    <span>
                      -{formatPrice(discount)}
                    </span>
                  </div>
                )}

                <div className="flex justify-between text-stone">
                  <span>Shipping</span>

                  <span>
                    {shippingLoading
                      ? "…"
                      : shipping === 0
                        ? "FREE"
                        : formatPrice(shipping)}
                  </span>
                </div>

                <div className="hairline my-1" />

                <div className="flex justify-between text-base text-bone">
                  <span>Total</span>

                  <span>
                    {formatPrice(total)}
                  </span>
                </div>

              </div>

            </aside>

          </div>
        </div>
      </main>
    </>
  );
}