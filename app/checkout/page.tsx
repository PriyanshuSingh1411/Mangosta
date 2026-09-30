"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import Navigation from "@/app/components/Navigation";
import ProductPlaceholderArt from "@/app/components/ProductPlaceholderArt";
import { useCartStore } from "@/app/store/useCartStore";
import { formatPrice } from "@/app/data/productTypes";
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

export default function CheckoutPage() {
  const { lines, subtotal, clearCart } = useCartStore();
  const { user, loading: authLoading } = useAuth();

  const [placed, setPlaced] = useState(false);
  const [failedLines, setFailedLines] = useState<Set<string>>(
    new Set()
  );

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(
    null
  );

  const [checkoutSettings, setCheckoutSettings] =
    useState<CheckoutSettings>(
      DEFAULT_CHECKOUT_SETTINGS
    );

  const [shippingLoading, setShippingLoading] =
    useState(true);

  const [couponCode, setCouponCode] =
    useState("");

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
    postalCode: "",
    cardNumber: "",
    expiry: "",
    cvc: "",
  });

  const shopCursor = useCursorHover("shop", "SHOP");

  const currentSubtotal = subtotal();

  useEffect(() => {
    if (authLoading || !user) return;

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
   * Load checkout / shipping settings
   * --------------------------------------------------------------------------
   */
  useEffect(() => {
    let cancelled = false;

    async function loadCheckoutSettings() {
      try {
        setShippingLoading(true);

        const response = await fetch(
          `/api/checkout?subtotal=${encodeURIComponent(
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
              "Failed to load shipping settings."
          );
        }

        if (!cancelled && data?.settings) {
          setCheckoutSettings({
            ...DEFAULT_CHECKOUT_SETTINGS,
            ...data.settings,
            rules: Array.isArray(
              data.settings.rules
            )
              ? data.settings.rules
              : [],
          });
        }
      } catch (err) {
        if (!cancelled) {
          setSubmitError(
            err instanceof Error
              ? err.message
              : "Failed to load shipping settings."
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
  }, [currentSubtotal]);

  /*
   * --------------------------------------------------------------------------
   * Load available coupons
   *
   * This calls the public coupon GET endpoint. It should return only coupons
   * that are enabled and currently active.
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
          const coupons = Array.isArray(
            data?.coupons
          )
            ? data.coupons
            : [];

          setAvailableCoupons(
            coupons.map(
              (coupon: CheckoutCoupon) => ({
                code: String(
                  coupon.code || ""
                )
                  .trim()
                  .toUpperCase(),
                discountType:
                  coupon.discountType ===
                  "fixed"
                    ? "fixed"
                    : "percentage",
                discountValue:
                  Number(
                    coupon.discountValue
                  ) || 0,
                minOrderValue:
                  Number(
                    coupon.minOrderValue
                  ) || 0,
                maxDiscount:
                  Number(
                    coupon.maxDiscount
                  ) || 0,
                startsAt:
                  coupon.startsAt || "",
                expiresAt:
                  coupon.expiresAt || "",
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
  const applyCouponCode = async (
    code: string
  ) => {
    const normalizedCode = code
      .trim()
      .toUpperCase()
      .replace(/\s+/g, "");

    if (!normalizedCode) {
      setCouponError(
        "Enter a coupon code."
      );
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
            "Content-Type":
              "application/json",
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

      if (
        !data?.coupon ||
        !data.coupon.code
      ) {
        throw new Error(
          "Invalid coupon response."
        );
      }

      const discount =
        Number(data.discount) || 0;

      if (discount <= 0) {
        throw new Error(
          "This coupon does not provide a discount for this order."
        );
      }

      setAppliedCoupon({
        code: String(
          data.coupon.code
        )
          .trim()
          .toUpperCase(),
        discountType:
          data.coupon
            .discountType === "fixed"
            ? "fixed"
            : "percentage",
        discountValue:
          Number(
            data.coupon.discountValue
          ) || 0,
        minOrderValue:
          Number(
            data.coupon.minOrderValue
          ) || 0,
        maxDiscount:
          Number(
            data.coupon.maxDiscount
          ) || 0,
        startsAt:
          data.coupon.startsAt || "",
        expiresAt:
          data.coupon.expiresAt || "",
        discount,
      });

      setCouponCode(
        String(data.coupon.code)
          .trim()
          .toUpperCase()
      );
      setCouponError(null);
    } catch (err) {
      setAppliedCoupon(null);

      setCouponError(
        err instanceof Error
          ? err.message
          : "Unable to apply coupon."
      );
    } finally {
      setCouponLoading(false);
    }
  };

  const applyCoupon = async () => {
    await applyCouponCode(
      couponCode
    );
  };

  /*
   * --------------------------------------------------------------------------
   * Remove coupon
   * --------------------------------------------------------------------------
   */
  const removeCoupon = () => {
    setAppliedCoupon(null);
    setCouponCode("");
    setCouponError(null);
  };

  /*
   * --------------------------------------------------------------------------
   * Revalidate applied coupon when subtotal changes
   * --------------------------------------------------------------------------
   */
  useEffect(() => {
    if (!appliedCoupon) {
      return;
    }

    const coupon = appliedCoupon;

    let cancelled = false;

    async function refreshCoupon() {
      try {
        const response = await fetch(
          "/api/checkout/coupon",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              code: coupon.code,
              subtotal:
                currentSubtotal,
            }),
          }
        );

        const data = await response
          .json()
          .catch(() => null);

        if (cancelled) {
          return;
        }

        if (!response.ok) {
          setAppliedCoupon(null);
          setCouponCode("");

          setCouponError(
            data?.error ||
              "Coupon is no longer valid for this order."
          );

          return;
        }

        const newDiscount =
          Number(data.discount) || 0;

        if (newDiscount <= 0) {
          setAppliedCoupon(null);
          setCouponCode("");

          setCouponError(
            "Coupon is no longer valid for this order."
          );

          return;
        }

        setAppliedCoupon(
          (current) =>
            current
              ? {
                  ...current,
                  discount:
                    newDiscount,
                }
              : current
        );

        setCouponError(null);
      } catch (err) {
        if (!cancelled) {
          setCouponError(
            err instanceof Error
              ? err.message
              : "Failed to refresh coupon."
          );
        }
      }
    }

    refreshCoupon();

    return () => {
      cancelled = true;
    };
  }, [
    currentSubtotal,
    appliedCoupon?.code,
  ]);

  /*
   * --------------------------------------------------------------------------
   * Calculate shipping
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
      .filter(
        (rule) => rule.enabled
      )
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
   * Calculate discount / final total
   * --------------------------------------------------------------------------
   */
  const discount =
    Math.min(
      currentSubtotal,
      Math.max(
        0,
        Number(
          appliedCoupon?.discount || 0
        )
      )
    );

  const discountedSubtotal =
    Math.max(
      0,
      currentSubtotal - discount
    );

  const total =
    discountedSubtotal + shipping;

  /*
   * --------------------------------------------------------------------------
   * Form helper
   * --------------------------------------------------------------------------
   */
  const updateField =
    (
      key: keyof typeof form
    ) =>
    (
      e: React.ChangeEvent<HTMLInputElement>
    ) => {
      setForm((current) => ({
        ...current,
        [key]: e.target.value,
      }));
    };

  /*
   * --------------------------------------------------------------------------
   * Submit order
   * --------------------------------------------------------------------------
   */
  const handleSubmit = async (
    e: React.FormEvent<HTMLFormElement>
  ) => {
    e.preventDefault();

    setSubmitError(null);
    setIsSubmitting(true);

    try {
      const response = await fetch(
        "/api/checkout",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            customer: {
              email: form.email,
              firstName:
                form.firstName,
              lastName:
                form.lastName,
              mobile:
                form.mobile,
              address: form.address,
              city: form.city,
              postalCode:
                form.postalCode,
            },

            lines: lines.map(
              (line) => ({
                lineId: line.lineId,
                productId:
                  line.product.id,
                productName:
                  line.product.name,
                slug:
                  line.product.slug,
                image:
                  line.product
                    .images[0] || "",
                size: line.size,
                color: line.color,
                quantity:
                  line.quantity,
                price:
                  line.product.price,
              })
            ),

            couponCode:
              appliedCoupon?.code ||
              "",
          }),
        }
      );

      if (!response.ok) {
        const data =
          await response
            .json()
            .catch(() => ({}));

        throw new Error(
          data?.error ||
            "Failed to place order. Please try again."
        );
      }

      setPlaced(true);
      clearCart();
    } catch (err) {
      setSubmitError(
        err instanceof Error
          ? err.message
          : "Something went wrong."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  /*
   * --------------------------------------------------------------------------
   * Empty cart
   * --------------------------------------------------------------------------
   */
  if (
    lines.length === 0 &&
    !placed
  ) {
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
   * Order placed
   * --------------------------------------------------------------------------
   */
  if (placed) {
    return (
      <>
        <Navigation />

        <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-void px-6 text-center">
          <p className="label-technical">
            ORDER CONFIRMED
          </p>

          <h1 className="font-display text-4xl tracking-tight text-bone sm:text-5xl">
            Thank you.
          </h1>

          <p className="max-w-md text-sm leading-relaxed text-stone">
            Your order has been placed
            successfully.
          </p>

          <Link
            href="/shop"
            {...shopCursor}
            className="border border-line-strong px-6 py-3 text-xs tracking-[0.15em] text-bone transition-colors hover:border-mango hover:text-mango"
          >
            CONTINUE SHOPPING
          </Link>
        </main>
      </>
    );
  }

  /*
   * --------------------------------------------------------------------------
   * Checkout page
   * --------------------------------------------------------------------------
   */
  return (
    <>
      <Navigation />

      <main className="min-h-screen bg-void px-6 pb-20 pt-28 sm:px-10 lg:px-12">
        <div className="mx-auto max-w-7xl">
          <div className="grid grid-cols-1 gap-12 lg:grid-cols-[1.25fr_0.9fr] lg:gap-16">
            {/* ---------------------------------------------------------------- */}
            {/* LEFT / FORM                                                      */}
            {/* ---------------------------------------------------------------- */}
            <form
              onSubmit={handleSubmit}
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
                    onChange={updateField(
                      "email"
                    )}
                    className="border border-line-strong bg-transparent px-4 py-3.5 text-sm text-bone placeholder:text-stone-dark focus:border-bone focus:outline-none"
                  />

                  <input
                    required
                    type="tel"
                    autoComplete="tel"
                    inputMode="tel"
                    placeholder="MOBILE NUMBER"
                    value={form.mobile}
                    onChange={updateField(
                      "mobile"
                    )}
                    className="border border-line-strong bg-transparent px-4 py-3.5 text-sm text-bone placeholder:text-stone-dark focus:border-bone focus:outline-none"
                  />

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <input
                      required
                      type="text"
                      autoComplete="given-name"
                      placeholder="FIRST NAME"
                      value={
                        form.firstName
                      }
                      onChange={updateField(
                        "firstName"
                      )}
                      className="border border-line-strong bg-transparent px-4 py-3.5 text-sm text-bone placeholder:text-stone-dark focus:border-bone focus:outline-none"
                    />

                    <input
                      required
                      type="text"
                      autoComplete="family-name"
                      placeholder="LAST NAME"
                      value={
                        form.lastName
                      }
                      onChange={updateField(
                        "lastName"
                      )}
                      className="border border-line-strong bg-transparent px-4 py-3.5 text-sm text-bone placeholder:text-stone-dark focus:border-bone focus:outline-none"
                    />
                  </div>
                </div>
              </fieldset>

              {/* SHIPPING */}
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
                    value={
                      form.address
                    }
                    onChange={updateField(
                      "address"
                    )}
                    className="border border-line-strong bg-transparent px-4 py-3.5 text-sm text-bone placeholder:text-stone-dark focus:border-bone focus:outline-none sm:col-span-2"
                  />

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <input
                      required
                      type="text"
                      autoComplete="address-level2"
                      placeholder="CITY"
                      value={form.city}
                      onChange={updateField(
                        "city"
                      )}
                      className="border border-line-strong bg-transparent px-4 py-3.5 text-sm text-bone placeholder:text-stone-dark focus:border-bone focus:outline-none"
                    />

                    <input
                      required
                      type="text"
                      autoComplete="postal-code"
                      placeholder="POSTAL CODE"
                      value={
                        form.postalCode
                      }
                      onChange={updateField(
                        "postalCode"
                      )}
                      className="border border-line-strong bg-transparent px-4 py-3.5 text-sm text-bone placeholder:text-stone-dark focus:border-bone focus:outline-none"
                    />
                  </div>
                </div>
              </fieldset>

              {/* PAYMENT */}
              <fieldset>
                <legend className="label-technical mb-5">
                  PAYMENT
                </legend>

                <div className="grid grid-cols-1 gap-4">
                  <input
                    required
                    type="text"
                    inputMode="numeric"
                    placeholder="CARD NUMBER"
                    value={
                      form.cardNumber
                    }
                    onChange={updateField(
                      "cardNumber"
                    )}
                    className="border border-line-strong bg-transparent px-4 py-3.5 text-sm text-bone placeholder:text-stone-dark focus:border-bone focus:outline-none"
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <input
                      required
                      type="text"
                      inputMode="numeric"
                      placeholder="MM / YY"
                      value={
                        form.expiry
                      }
                      onChange={updateField(
                        "expiry"
                      )}
                      className="border border-line-strong bg-transparent px-4 py-3.5 text-sm text-bone placeholder:text-stone-dark focus:border-bone focus:outline-none"
                    />

                    <input
                      required
                      type="text"
                      inputMode="numeric"
                      placeholder="CVC"
                      value={form.cvc}
                      onChange={updateField(
                        "cvc"
                      )}
                      className="border border-line-strong bg-transparent px-4 py-3.5 text-sm text-bone placeholder:text-stone-dark focus:border-bone focus:outline-none"
                    />
                  </div>
                </div>

                <p className="mt-3 text-xs text-stone-dark">
                  This is a visual checkout
                  preview. Card details are
                  not transmitted or validated,
                  but the order itself is real
                  and will appear in the admin
                  panel.
                </p>
              </fieldset>

              {submitError && (
                <p
                  role="alert"
                  className="text-sm text-mango"
                >
                  {submitError}
                </p>
              )}

              <button
                type="submit"
                disabled={
                  isSubmitting ||
                  shippingLoading
                }
                className="bg-bone py-4 text-center text-xs font-medium tracking-[0.2em] text-void transition-colors hover:bg-mango disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSubmitting
                  ? "PLACING ORDER…"
                  : `PLACE ORDER — ${formatPrice(
                      total
                    )}`}
              </button>
            </form>

            {/* ---------------------------------------------------------------- */}
            {/* RIGHT / ORDER SUMMARY                                             */}
            {/* ---------------------------------------------------------------- */}
            <div className="h-fit border border-line bg-charcoal p-6 sm:p-8">
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
                      {line.product
                        .images[0] &&
                      !failedLines.has(
                        line.lineId
                      ) ? (
                        <Image
                          src={
                            line.product
                              .images[0]
                          }
                          alt={
                            line.product.name
                          }
                          fill
                          sizes="64px"
                          className="object-cover"
                          onError={() =>
                            setFailedLines(
                              (previous) => {
                                const next =
                                  new Set(
                                    previous
                                  );

                                next.add(
                                  line.lineId
                                );

                                return next;
                              }
                            )
                          }
                        />
                      ) : (
                        <ProductPlaceholderArt
                          seed={
                            line.product.id
                          }
                          className="h-full w-full"
                        />
                      )}
                    </div>

                    <div className="flex flex-1 flex-col justify-between">
                      <div>
                        <p className="text-sm text-bone">
                          {
                            line.product
                              .name
                          }
                        </p>

                        <p className="mt-1 text-xs text-stone">
                          {line.color} /{" "}
                          {line.size} ×{" "}
                          {line.quantity}
                        </p>
                      </div>

                      <p className="font-mono text-xs text-bone-dim">
                        {formatPrice(
                          line.product.price *
                            line.quantity
                        )}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>

              <div className="hairline my-6" />

              {/* ---------------------------------------------------------------- */}
              {/* COUPON                                                           */}
              {/* ---------------------------------------------------------------- */}
              <div className="mb-6">
                <p className="label-technical mb-3">
                  COUPON CODE
                </p>

                {appliedCoupon ? (
                  <div className="flex items-center justify-between gap-3 border border-line-strong px-3.5 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm text-bone">
                        {
                          appliedCoupon.code
                        }
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
                      onClick={
                        removeCoupon
                      }
                      className="shrink-0 text-xs text-stone transition-colors hover:text-mango"
                    >
                      REMOVE
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      autoComplete="off"
                      value={
                        couponCode
                      }
                      onChange={(e) => {
                        setCouponCode(
                          e.target.value
                            .toUpperCase()
                            .replace(
                              /\s+/g,
                              ""
                            )
                        );

                        setCouponError(
                          null
                        );
                      }}
                      onKeyDown={(e) => {
                        if (
                          e.key === "Enter"
                        ) {
                          e.preventDefault();
                          applyCoupon();
                        }
                      }}
                      placeholder="ENTER CODE"
                      className="min-w-0 flex-1 border border-line-strong bg-transparent px-3.5 py-3 text-sm text-bone placeholder:text-stone-dark focus:border-bone focus:outline-none"
                    />

                    <button
                      type="button"
                      onClick={
                        applyCoupon
                      }
                      disabled={
                        couponLoading
                      }
                      className="shrink-0 border border-line-strong px-4 py-3 text-xs tracking-[0.12em] text-bone transition-colors hover:border-mango hover:text-mango disabled:opacity-50"
                    >
                      {couponLoading
                        ? "CHECKING…"
                        : "APPLY"}
                    </button>
                  </div>
                )}

                {/* AVAILABLE COUPONS */}
                {!appliedCoupon &&
                  availableCoupons.length >
                    0 && (
                    <div className="mt-4">
                      <p className="mb-2 text-xs text-stone">
                        AVAILABLE COUPONS
                      </p>

                      <div className="flex flex-col gap-2">
                        {availableCoupons.map(
                          (coupon) => {
                            const meetsMinimum =
                              currentSubtotal >=
                              coupon.minOrderValue;

                            return (
                              <div
                                key={
                                  coupon.code
                                }
                                className="flex items-center justify-between gap-3 border border-line px-3 py-2.5"
                              >
                                <div className="min-w-0">
                                  <p className="font-mono text-xs text-bone">
                                    {
                                      coupon.code
                                    }
                                  </p>

                                  <p className="mt-1 text-[11px] text-stone">
                                    {coupon.discountType ===
                                    "percentage"
                                      ? `${coupon.discountValue}% OFF`
                                      : `${formatPrice(
                                          coupon.discountValue
                                        )} OFF`}

                                    {coupon.minOrderValue >
                                      0
                                      ? ` · MIN ${formatPrice(
                                          coupon.minOrderValue
                                        )}`
                                      : ""}
                                  </p>
                                </div>

                                <button
                                  type="button"
                                  onClick={() =>
                                    applyCouponCode(
                                      coupon.code
                                    )
                                  }
                                  disabled={
                                    !meetsMinimum ||
                                    couponLoading
                                  }
                                  className="shrink-0 text-xs tracking-[0.12em] text-bone transition-colors hover:text-mango disabled:cursor-not-allowed disabled:text-stone-dark"
                                >
                                  {meetsMinimum
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
                  availableCoupons.length ===
                    0 && (
                    <p className="mt-2 text-xs text-stone-dark">
                      Loading available
                      coupons…
                    </p>
                  )}

                {couponError && (
                  <p
                    role="alert"
                    className="mt-2 text-xs text-mango"
                  >
                    {couponError}
                  </p>
                )}
              </div>

              {/* PRICE SUMMARY */}
              <div className="flex flex-col gap-3 font-mono text-sm">
                <div className="flex justify-between text-stone">
                  <span>
                    Subtotal
                  </span>

                  <span>
                    {formatPrice(
                      currentSubtotal
                    )}
                  </span>
                </div>

                {discount > 0 && (
                  <div className="flex justify-between text-mango">
                    <span>
                      Discount
                      {appliedCoupon
                        ? ` (${appliedCoupon.code})`
                        : ""}
                    </span>

                    <span>
                      -
                      {formatPrice(
                        discount
                      )}
                    </span>
                  </div>
                )}

                <div className="flex justify-between text-stone">
                  <span>
                    Shipping
                  </span>

                  <span>
                    {shippingLoading
                      ? "…"
                      : shipping === 0
                        ? "FREE"
                        : formatPrice(
                            shipping
                          )}
                  </span>
                </div>

                <div className="hairline my-1" />

                <div className="flex justify-between text-base text-bone">
                  <span>
                    Total
                  </span>

                  <span>
                    {formatPrice(
                      total
                    )}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}