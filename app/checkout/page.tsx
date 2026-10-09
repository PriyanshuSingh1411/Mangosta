"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";

import Navigation from "@/app/components/Navigation";
import ProductPlaceholderArt from "@/app/components/ProductPlaceholderArt";
import { maxAllowedForLine, useCartStore } from "@/app/store/useCartStore";
import {
  formatPrice,
  getProductSalePrice,
  hasProductDiscount,
  getProductStrikethroughPrice,
  getProductSavingsAmount,
  getProductSavingsPercent,
} from "@/app/data/productTypes";
import { useCursorHover } from "@/app/lib/useCursorHover";
import { useAuth } from "@/app/components/AuthProvider";
import { formatDeliveryRange } from "@/app/data/storeTypes";
import type { PincodeCheckResult } from "@/app/data/storeTypes";
import { trackEngagement } from "@/app/lib/trackEngagement";

type CheckoutReward = {
  id: string;
  enabled: boolean;
  threshold: number;
  discountPercent: number;
  couponCode: string;
};

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
  progressRewards: CheckoutReward[];
};

const DEFAULT_CHECKOUT_SETTINGS: CheckoutSettings = {
  enabled: true,
  defaultShipping: 12,
  freeShippingEnabled: true,
  freeShippingThreshold: 10,
  rules: [],
  progressRewards: [],
};

const normalizeIndianMobile = (value: string) => {
  const digits = String(value || "").replace(/\D/g, "");

  if (digits.length === 12 && digits.startsWith("91")) {
    return digits.slice(2);
  }

  return digits.slice(0, 10);
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
  isProgressReward?: boolean;
};

type SavedAddress = {
  id: string;
  name: string;
  phone: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  pincode: string;
};

export default function CheckoutPage() {
  const router = useRouter();
  const { lines, subtotal } = useCartStore();
  const { user, loading: authLoading, openAuth } = useAuth();

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

  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState("");

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

  // Saved on product discounts, measured against the crossed-out prices
  // shown on each line (so this total matches what the shopper sees).
  const productDiscount = useMemo(() => {
    return lines.reduce(
      (sum, line) =>
        sum + getProductSavingsAmount(line.product) * line.quantity,
      0
    );
  }, [lines]);

  /*
   * --------------------------------------------------------------------------
   * PIN code check
   * --------------------------------------------------------------------------
   */

  const [delivery, setDelivery] = useState<
    (PincodeCheckResult & {
      enabled: boolean;
      pincode: string;
    }) | null
  >(null);

  /** Delivery estimate + COD availability for a PIN code. */
  const checkDelivery = async (
    pincode: string
  ) => {
    try {
      const response = await fetch(
        `/api/delivery/check?pincode=${pincode}`,
        { cache: "no-store" }
      );

      const data = await response.json();

      setDelivery({
        ...data,
        pincode,
      });
    } catch {
      setDelivery(null);
    }
  };

  /*
   * --------------------------------------------------------------------------
   * Prefill logged-in customer
   * --------------------------------------------------------------------------
   */

  // Once per signed-in account (adjusted while rendering instead of in an
  // effect, so the form never shows a flash of empty fields).
  const [prefilledFor, setPrefilledFor] = useState<string | null>(null);
  if (!authLoading && user && prefilledFor !== user.id) {
    setPrefilledFor(user.id);
    setForm((current) => ({
      ...current,
      email: user.email || current.email,
      firstName: user.firstName || current.firstName,
      lastName: user.lastName || current.lastName,
      mobile: normalizeIndianMobile(user.mobile || current.mobile),
    }));
  }

  /*
   * --------------------------------------------------------------------------
   * Load saved addresses
   * --------------------------------------------------------------------------
   */

  useEffect(() => {
    if (authLoading || !user) return;

    let cancelled = false;

    async function loadSavedAddresses() {
      try {
        const response = await fetch(
          "/api/account/addresses",
          { cache: "no-store" }
        );

        const data = await response.json().catch(() => null);

        if (
          !response.ok ||
          !Array.isArray(data?.addresses) ||
          cancelled
        ) {
          return;
        }

        const addresses = data.addresses as SavedAddress[];

        setSavedAddresses(addresses);

        const preferred = addresses[0];

        if (!preferred) return;

        setSelectedAddressId(preferred.id);

        const nameParts = String(preferred.name || "")
          .trim()
          .split(/\s+/)
          .filter(Boolean);

        setForm((current) => ({
          ...current,
          firstName: nameParts[0] || current.firstName,
          lastName:
            nameParts.slice(1).join(" ") || current.lastName,
          mobile: normalizeIndianMobile(
            preferred.phone || current.mobile
          ),
          address: [
            preferred.line1,
            preferred.line2,
          ]
            .filter(Boolean)
            .join(", "),
          city: preferred.city || current.city,
          state: preferred.state || current.state,
          postalCode:
            preferred.pincode || current.postalCode,
        }));

        if (
          preferred.pincode &&
          preferred.pincode.length === 6
        ) {
          void checkDelivery(preferred.pincode);
        }
      } catch {
        if (!cancelled) {
          setSavedAddresses([]);
        }
      }
    }

    void loadSavedAddresses();

    return () => {
      cancelled = true;
    };
  }, [authLoading, user]);

  const selectSavedAddress = (id: string) => {
    const saved = savedAddresses.find(
      (item) => item.id === id
    );

    setSelectedAddressId(id);

    if (!saved) return;

    const nameParts = String(saved.name || "")
      .trim()
      .split(/\s+/)
      .filter(Boolean);

    const postalCode = saved.pincode || "";

    setForm((current) => ({
      ...current,
      firstName: nameParts[0] || "",
      lastName: nameParts.slice(1).join(" "),
      mobile: normalizeIndianMobile(saved.phone || ""),
      address: [
        saved.line1,
        saved.line2,
      ]
        .filter(Boolean)
        .join(", "),
      city: saved.city || "",
      state: saved.state || "",
      postalCode,
    }));

    setDelivery(null);

    if (postalCode.length === 6) {
      void checkDelivery(postalCode);
    }
  };

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
            progressRewards: Array.isArray(
              data.settings.progressRewards
            )
              ? data.settings.progressRewards
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
   * Progress rewards
   * --------------------------------------------------------------------------
   */

  // The best unlocked cart-value reward is applied automatically (unless
  // the customer applied a regular coupon). Checked whenever the subtotal,
  // the rewards or the applied coupon change - while rendering, so the
  // total never shows a stale discount for a moment.
  const rewardCheckKey = JSON.stringify([
    currentSubtotal,
    checkoutSettings.progressRewards,
    appliedCoupon?.code ?? "",
    Boolean(appliedCoupon?.isProgressReward),
    appliedCoupon?.discount ?? 0,
  ]);
  const [rewardCheckedFor, setRewardCheckedFor] = useState("");

  if (rewardCheckKey !== rewardCheckedFor) {
    setRewardCheckedFor(rewardCheckKey);

    const rewards = (
      checkoutSettings.progressRewards || []
    )
      .filter(
        (reward) =>
          reward.enabled &&
          reward.couponCode &&
          reward.threshold >= 0
      )
      .sort(
        (a, b) =>
          a.threshold - b.threshold
      );

    const unlocked = [...rewards]
      .reverse()
      .find(
        (reward) =>
          currentSubtotal >= reward.threshold
      );

    const currentIsReward = Boolean(
      appliedCoupon?.isProgressReward
    );

    if (!unlocked) {
      if (currentIsReward) {
        setAppliedCoupon(null);
        setCouponCode("");
      }
    } else if (!appliedCoupon || currentIsReward) {
      const discount = Math.min(
        currentSubtotal,
        Math.round(
          currentSubtotal *
            (unlocked.discountPercent / 100) *
            100
        ) / 100
      );

      const alreadyApplied =
        currentIsReward &&
        appliedCoupon?.code === unlocked.couponCode &&
        appliedCoupon?.discount === discount;

      if (!alreadyApplied) {
        setAppliedCoupon({
          code: unlocked.couponCode,
          discountType: "percentage",
          discountValue:
            unlocked.discountPercent,
          minOrderValue: unlocked.threshold,
          maxDiscount: 0,
          startsAt: "",
          expiresAt: "",
          discount,
          isProgressReward: true,
        });

        setCouponCode(unlocked.couponCode);
        setCouponError(null);
      }
    }
  }

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

  const applyCouponCode = async (code: string) => {
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
        code: String(
          data.coupon.code
        )
          .trim()
          .toUpperCase(),

        discountType:
          data.coupon.discountType ===
          "fixed"
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

        isProgressReward:
          Boolean(
            data.coupon
              .isProgressReward
          ),

        discount,
      });
void trackEngagement({
  event: "coupon_apply",
  metadata: {
    couponCode: normalizedCode,
    discount,
    discountType:
      data.coupon.discountType === "fixed"
        ? "fixed"
        : "percentage",
    subtotal: currentSubtotal,
    isProgressReward: Boolean(
      data.coupon.isProgressReward
    ),
  },
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
    if (appliedCoupon?.isProgressReward) {
      return;
    }

    setAppliedCoupon(null);
    setCouponCode("");
    setCouponError(null);
  };

  const progressRewards = [
    ...(checkoutSettings.progressRewards || []),
  ]
    .filter(
      (reward) =>
        reward.enabled &&
        reward.threshold >= 0 &&
        reward.discountPercent > 0
    )
    .sort(
      (a, b) =>
        a.threshold - b.threshold
    );

  const unlockedReward =
    [...progressRewards]
      .reverse()
      .find(
        (reward) =>
          currentSubtotal >= reward.threshold
      ) || null;

  const nextReward =
    progressRewards.find(
      (reward) =>
        currentSubtotal < reward.threshold
    ) || null;

 /**
  * Unlock bar: each reward's circle sits at the centre of its own equal
  * column (so circles never hang off the ends and every label has the
  * same room, on any screen). The fill grows from the start of the bar to
  * the first circle, then step by step between circles.
  */
 const rewardPosition = (index: number) =>
   ((index + 0.5) / Math.max(1, progressRewards.length)) * 100;

 const progressPercent = (() => {
  if (progressRewards.length === 0) {
    return 0;
  }

  const last = progressRewards.length - 1;

  if (currentSubtotal >= progressRewards[last].threshold) {
    return 100;
  }

  const firstThreshold = progressRewards[0].threshold;

  if (currentSubtotal < firstThreshold) {
    return firstThreshold > 0
      ? Math.max(0, (currentSubtotal / firstThreshold) * rewardPosition(0))
      : 0;
  }

  for (let index = 0; index < last; index += 1) {
    const from = progressRewards[index].threshold;
    const to = progressRewards[index + 1].threshold;

    if (currentSubtotal < to) {
      const part = to > from ? (currentSubtotal - from) / (to - from) : 1;
      return (
        rewardPosition(index) +
        part * (rewardPosition(index + 1) - rewardPosition(index))
      );
    }
  }

  return 100;
})();

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
   * Discount + total
   * --------------------------------------------------------------------------
   */

  const discount = Math.min(
    currentSubtotal,
    Math.max(
      0,
      Number(
        appliedCoupon?.discount || 0
      )
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

    setDelivery(null);

    if (value.length === 6) {
      void checkDelivery(value);
    }
  };


  /*
   * --------------------------------------------------------------------------
   * Continue to payment
   * --------------------------------------------------------------------------
   */

  const handleContinueToPayment = (
    event: React.FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    setSubmitError(null);

    // Orders are placed from the customer's account (the server refuses
    // signed-out orders), so ask them to sign in first.
    if (!user) {
      if (authLoading) {
        setSubmitError(
          "Checking your sign-in. Please try again in a moment."
        );
        return;
      }

      setSubmitError(
        "Please sign in to place your order."
      );
      openAuth("signin");
      return;
    }

    const normalizedMobile =
      normalizeIndianMobile(
        form.mobile
      );

    if (
      !/^[6-9]\d{9}$/.test(
        normalizedMobile
      )
    ) {
      setSubmitError(
        "Please enter a valid 10-digit mobile number."
      );
      return;
    }

    if (
      form.postalCode.length !== 6
    ) {
      setSubmitError(
        "Please enter a valid 6-digit PIN code."
      );
      return;
    }

    if (
      delivery &&
      delivery.pincode ===
        form.postalCode &&
      delivery.enabled &&
      delivery.valid &&
      !delivery.serviceable
    ) {
      setSubmitError(
        `Sorry, we don't deliver to PIN code ${form.postalCode} yet.`
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
          // Shown only; the server always uses the account's email.
          email: user.email || form.email,
          firstName: form.firstName,
          lastName: form.lastName,
          mobile: normalizedMobile,
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
void trackEngagement({
  event: "checkout_start",
  metadata: {
    itemCount: lines.reduce(
      (total, line) => total + line.quantity,
      0
    ),
    uniqueProducts: lines.length,
    subtotal: currentSubtotal,
    discount,
    shipping,
    total,
    couponCode: appliedCoupon?.code || "",
    couponType: appliedCoupon?.isProgressReward
      ? "progress_reward"
      : appliedCoupon?.code
        ? "coupon"
        : "none",
  },
});
      router.push("/checkout/payment");
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

          <h1 className="type-title text-bone">
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

      <main className="min-h-screen bg-void px-5 pb-24 pt-28 sm:px-8 sm:pt-32 lg:px-12">
        <div className="mx-auto max-w-7xl">

          {/* HEADER */}

          <div className="mb-10">
            <p className="label-technical mb-3">
              CHECKOUT
            </p>

            <h1 className="type-title text-bone">
              Complete your order.
            </h1>

            <p className="mt-3 text-sm text-stone">
              Enter your delivery details
              before continuing to payment.
            </p>
          </div>

          {progressRewards.length > 0 && (
            <section className="relative mb-12 overflow-hidden border border-mango/30 bg-charcoal p-5 sm:p-7">
              <div className="pointer-events-none absolute -right-16 -top-20 h-48 w-48 rounded-full bg-mango/10 blur-3xl" />

              <div className="relative">
                <div className="flex items-end justify-between gap-4">
                  <div>
                    <p className="label-technical text-mango">
                      MANGOSTA UNLOCKS
                    </p>

                    <h2 className="mt-2 type-heading text-bone">
                      BUILD YOUR DISCOUNT.
                    </h2>
                  </div>

                  <span className="hidden font-mono text-[10px] tracking-[0.16em] text-stone sm:block">
                    CART REWARD SYSTEM
                  </span>
                </div>

                <div className="mt-8">
                  <div className="relative h-2 rounded-full bg-line">
                    <div
                      className="absolute left-0 top-0 h-2 rounded-full bg-mango transition-all duration-700"
                      style={{
                        width: `${progressPercent}%`,
                      }}
                    />

                    {progressRewards.map(
                      (reward, index) => {
                        const unlocked =
                          currentSubtotal >=
                          reward.threshold;
                        const position = rewardPosition(index);

                        return (
                          <div
                            key={reward.id}
                            className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2"
                            style={{
                              left: `${position}%`,
                            }}
                          >
                            <div
                              className={`flex h-7 w-7 items-center justify-center rounded-full border-2 text-[9px] font-bold transition-all duration-500 ${
                                unlocked
                                  ? "border-mango bg-mango text-void shadow-[0_0_18px_rgba(190,255,0,0.35)]"
                                  : "border-line-strong bg-void text-stone"
                              }`}
                            >
                              {unlocked
                                ? "✓"
                                : `${index + 1}`}
                            </div>
                          </div>
                        );
                      }
                    )}
                  </div>

                  {/* One equal column per reward, centred under its circle */}
                  <div
                    className="mt-4 grid"
                    style={{
                      gridTemplateColumns: `repeat(${progressRewards.length}, minmax(0, 1fr))`,
                    }}
                  >
                    {progressRewards.map(
                      (reward) => {
                        const unlocked =
                          currentSubtotal >=
                          reward.threshold;

                        return (
                          <div
                            key={reward.id}
                            className="flex min-w-0 flex-col items-center px-1 text-center"
                          >
                            {/* "UNLOCKED" drops below the amount when there is no room */}
                            <div className="flex flex-wrap items-center justify-center gap-x-1.5 gap-y-1">
                              <p
                                className={`type-price text-xs ${
                                  unlocked
                                    ? "text-mango"
                                    : "text-stone"
                                }`}
                              >
                                ₹
                                {reward.threshold.toLocaleString(
                                  "en-IN"
                                )}
                              </p>

                              {unlocked && (
                                <span className="whitespace-nowrap rounded-full border border-mango/30 bg-mango/10 px-1.5 py-0.5 text-[8px] font-medium tracking-[0.12em] text-mango">
                                  UNLOCKED
                                </span>
                              )}
                            </div>

                            <p
                              className={`mt-1 text-[10px] tracking-[0.08em] ${
                                unlocked
                                  ? "text-bone"
                                  : "text-stone-dark"
                              }`}
                            >
                              {reward.discountPercent}%
                              OFF
                            </p>

                            {unlocked &&
                              reward.couponCode && (
                                <p
                                  className="mt-1 max-w-full break-words font-mono text-[9px] tracking-[0.08em] text-mango/80"
                                  title={
                                    reward.couponCode
                                  }
                                >
                                  {
                                    reward.couponCode
                                  }
                                </p>
                              )}
                          </div>
                        );
                      }
                    )}
                  </div>
                </div>

                <div className="mt-6 border border-line bg-void/60 px-4 py-4">
                  {unlockedReward &&
                  appliedCoupon?.isProgressReward ? (
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-sm font-medium text-bone">
                          {
                            unlockedReward.discountPercent
                          }
                          % OFF UNLOCKED.
                        </p>

                        <p className="mt-1 text-xs text-stone">
                          Code{" "}
                          <span className="font-mono text-mango">
                            {
                              unlockedReward.couponCode
                            }
                          </span>{" "}
                          is automatically applied to this checkout.
                        </p>
                      </div>

                      {nextReward && (
                        <p className="type-price text-xs text-mango">
                          ₹
                          {Math.max(
                            0,
                            nextReward.threshold -
                              currentSubtotal
                          ).toLocaleString(
                            "en-IN"
                          )}{" "}
                          TO UNLOCK{" "}
                          {
                            nextReward.discountPercent
                          }
                          % OFF
                        </p>
                      )}
                    </div>
                  ) : nextReward ? (
                    <p className="text-sm text-bone-dim">
                      YOU&apos;RE{" "}
                      <span className="type-price text-mango">
                        ₹
                        {Math.max(
                          0,
                          nextReward.threshold -
                            currentSubtotal
                        ).toLocaleString(
                          "en-IN"
                        )}
                      </span>{" "}
                      AWAY FROM{" "}
                      <span className="font-mono text-mango">
                        {
                          nextReward.discountPercent
                        }
                        % OFF
                      </span>
                      .
                    </p>
                  ) : (
                    <p className="text-sm font-medium text-mango">
                      ALL THREE REWARDS UNLOCKED. YOUR BEST DISCOUNT IS APPLIED.
                    </p>
                  )}
                </div>

                {unlockedReward?.couponCode &&
                  appliedCoupon?.isProgressReward && (
                    <div className="mt-3 flex flex-col gap-3 border border-mango/30 bg-mango/5 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="label-technical text-mango">
                          REWARD COUPON
                        </p>

                        <p className="mt-1 font-mono text-sm tracking-[0.12em] text-bone">
                          {
                            unlockedReward.couponCode
                          }
                        </p>
                      </div>

                      <div className="flex items-center gap-2 text-[10px] font-medium tracking-[0.12em] text-mango">
                        <span className="h-1.5 w-1.5 rounded-full bg-mango" />
                        AUTOMATICALLY APPLIED
                      </div>
                    </div>
                  )}
              </div>
            </section>
          )}

          <div className="grid grid-cols-1 gap-12 lg:grid-cols-[1.2fr_0.8fr] lg:gap-16">

            {/* CUSTOMER FORM */}

            <form
              onSubmit={
                handleContinueToPayment
              }
              className="flex flex-col gap-10"
            >

              {/* CONTACT */}

              <fieldset>
                <legend className="label-technical mb-5">
                  CONTACT
                </legend>

                <div className="grid grid-cols-1 gap-4">
                  {/* Account email: fixed, the order is always sent to it */}
                  <div>
                    <input
                      readOnly
                      aria-readonly="true"
                      type="email"
                      autoComplete="email"
                      placeholder="EMAIL"
                      aria-label="Email (your account email)"
                      value={user?.email || ""}
                      className="w-full cursor-default border border-line bg-transparent px-4 py-4 text-sm text-stone placeholder:text-stone-dark focus:outline-none"
                    />

                    {user ? (
                      <p className="mt-2 text-xs text-stone">
                        Order updates are sent to your account email.
                      </p>
                    ) : !authLoading ? (
                      <p className="mt-2 text-xs text-stone">
                        <button
                          type="button"
                          onClick={() =>
                            openAuth("signin")
                          }
                          className="text-bone underline underline-offset-4 transition-colors hover:text-mango"
                        >
                          Sign in
                        </button>{" "}
                        to place your order.
                      </p>
                    ) : null}
                  </div>

                  <input
                    required
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel"
                    placeholder="MOBILE NUMBER"
                    value={form.mobile}
                    onChange={
                      handleMobileChange
                    }
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
                      onChange={updateField(
                        "firstName"
                      )}
                      className="border border-line-strong bg-transparent px-4 py-4 text-sm text-bone placeholder:text-stone-dark focus:border-bone focus:outline-none"
                    />

                    <input
                      required
                      type="text"
                      autoComplete="family-name"
                      placeholder="LAST NAME"
                      value={form.lastName}
                      onChange={updateField(
                        "lastName"
                      )}
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

                {savedAddresses.length >
                  0 && (
                  <div className="mb-5 border border-mango/30 bg-mango/5 p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="label-technical text-mango">
                          SAVED ADDRESS
                        </p>

                        <p className="mt-1 text-xs text-stone">
                          Your saved address has been filled in automatically.
                        </p>
                      </div>

                      {savedAddresses.length >
                        1 && (
                        <select
                          value={
                            selectedAddressId
                          }
                          onChange={(event) =>
                            selectSavedAddress(
                              event.target
                                .value
                            )
                          }
                          className="border border-line-strong bg-void px-3 py-2 text-xs text-bone focus:border-mango focus:outline-none"
                        >
                          {savedAddresses.map(
                            (saved) => (
                              <option
                                key={saved.id}
                                value={
                                  saved.id
                                }
                              >
                                {saved.name} —{" "}
                                {saved.city}
                              </option>
                            )
                          )}
                        </select>
                      )}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 gap-4">
                  <input
                    required
                    type="text"
                    autoComplete="street-address"
                    placeholder="ADDRESS"
                    value={form.address}
                    onChange={updateField(
                      "address"
                    )}
                    className="border border-line-strong bg-transparent px-4 py-4 text-sm text-bone placeholder:text-stone-dark focus:border-bone focus:outline-none"
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
                      className="border border-line-strong bg-transparent px-4 py-4 text-sm text-bone placeholder:text-stone-dark focus:border-bone focus:outline-none"
                    />

                    <select
                      required
                      value={form.state}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          state: event.target
                            .value,
                        }))
                      }
                      className="border border-line-strong bg-void px-4 py-4 text-sm text-bone focus:border-bone focus:outline-none"
                    >
                      <option
                        value=""
                        disabled
                      >
                        SELECT STATE
                      </option>

                      {INDIAN_STATES.map(
                        (state) => (
                          <option
                            key={state}
                            value={state}
                            className="bg-void"
                          >
                            {state}
                          </option>
                        )
                      )}
                    </select>
                  </div>

                  <input
                    required
                    type="text"
                    inputMode="numeric"
                    autoComplete="postal-code"
                    placeholder="PIN CODE"
                    value={form.postalCode}
                    onChange={
                      handlePostalCodeChange
                    }
                    maxLength={6}
                    className="border border-line-strong bg-transparent px-4 py-4 text-sm text-bone placeholder:text-stone-dark focus:border-bone focus:outline-none"
                  />

                  {delivery &&
                    delivery.enabled &&
                    delivery.pincode ===
                      form.postalCode && (
                      <p
                        aria-live="polite"
                        className={`text-xs ${
                          delivery.valid &&
                          delivery.serviceable
                            ? "text-stone"
                            : "text-mango"
                        }`}
                      >
                        {!delivery.valid
                          ? "Please enter a valid 6-digit PIN code."
                          : !delivery.serviceable
                            ? `Sorry, we don't deliver to ${form.postalCode} yet.`
                            : `Estimated delivery ${formatDeliveryRange(
                                delivery.minDays,
                                delivery.maxDays
                              )}${
                                delivery.cod
                                  ? ""
                                  : " · Cash on delivery not available"
                              }`}
                      </p>
                    )}
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
                disabled={
                  shippingLoading ||
                  !/^[6-9]\d{9}$/.test(
                    normalizeIndianMobile(
                      form.mobile
                    )
                  ) ||
                  form.postalCode.length !==
                    6
                }
                className="w-full bg-bone py-4 text-center text-xs font-medium tracking-[0.2em] text-void transition-colors hover:bg-mango disabled:cursor-not-allowed disabled:opacity-50"
              >
                {shippingLoading
                  ? "CALCULATING…"
                  : `CONTINUE TO PAYMENT — ${formatPrice(
                      total
                    )}`}
              </button>
            </form>

            {/* ORDER SUMMARY */}

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
                          {line.product.name}
                        </p>

                        <p className="mt-1 text-xs text-stone">
                          {line.color} /{" "}
                          {line.size}
                        </p>

                        <div
                          className="mt-3 inline-flex items-center border border-line-strong bg-void"
                          aria-label={`Quantity for ${line.product.name}`}
                        >
                          <button
                            type="button"
                            onClick={() =>
                              useCartStore
                                .getState()
                                .updateQuantity(
                                  line.lineId,
                                  line.quantity -
                                    1
                                )
                            }
                            className="flex h-8 w-8 items-center justify-center text-sm text-stone transition-colors hover:bg-bone hover:text-void focus:outline-none focus:ring-1 focus:ring-mango"
                            aria-label={`Decrease ${line.product.name} quantity`}
                          >
                            −
                          </button>

                          <span className="flex h-8 min-w-8 items-center justify-center border-x border-line-strong px-2 font-mono text-xs text-bone">
                            {line.quantity}
                          </span>

                          <button
                            type="button"
                            onClick={() =>
                              useCartStore
                                .getState()
                                .updateQuantity(
                                  line.lineId,
                                  line.quantity +
                                    1
                                )
                            }
                            disabled={
                              line.quantity >=
                              maxAllowedForLine(
                                lines,
                                line.product,
                                line.size,
                                line.color,
                                line.lineId
                              )
                            }
                            className="flex h-8 w-8 items-center justify-center text-sm text-stone transition-colors hover:bg-bone hover:text-void focus:outline-none focus:ring-1 focus:ring-mango disabled:cursor-not-allowed disabled:opacity-30"
                            aria-label={`Increase ${line.product.name} quantity`}
                          >
                            +
                          </button>
                        </div>
                      </div>

                      <div className="text-right">
                        {hasProductDiscount(
                          line.product
                        ) && (
                          <>
                            {getProductStrikethroughPrice(
                              line.product
                            ) !== null && (
                              <p className="font-body tabular-nums text-[10px] text-stone-dark line-through">
                                {formatPrice(
                                  (getProductStrikethroughPrice(
                                    line.product
                                  ) ?? 0) *
                                    line.quantity
                                )}
                              </p>
                            )}

                            <p className="type-price text-xs font-semibold text-mango">
                              {formatPrice(
                                getProductSalePrice(
                                  line.product
                                ) *
                                  line.quantity
                              )}
                            </p>

                            {getProductSavingsPercent(line.product) !== null && (
                              <p className="mt-1 inline-block rounded-sm bg-mango/10 px-1.5 py-[3px] text-[10px] font-semibold uppercase leading-none tracking-[0.08em] text-mango">
                                Save {getProductSavingsPercent(line.product)}%
                              </p>
                            )}
                          </>
                        )}

                        {!hasProductDiscount(
                          line.product
                        ) && (
                          <p className="type-price text-xs text-bone-dim">
                            {formatPrice(
                              getProductSalePrice(
                                line.product
                              ) *
                                line.quantity
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
                  <div
                    className={`flex items-center justify-between border px-4 py-3 ${
                      appliedCoupon.isProgressReward
                        ? "border-mango/40 bg-mango/5"
                        : "border-line-strong"
                    }`}
                  >
                    <div>
                      <p className="font-mono text-xs text-bone">
                        {
                          appliedCoupon.code
                        }
                      </p>

                      {appliedCoupon.isProgressReward && (
                        <p className="mt-1 text-[10px] uppercase tracking-[0.12em] text-mango">
                          Auto-unlocked reward
                        </p>
                      )}

                      <p className="mt-1 text-xs text-mango">
                        {appliedCoupon.discountType ===
                        "percentage"
                          ? `${appliedCoupon.discountValue}% OFF`
                          : `${formatPrice(
                              appliedCoupon.discountValue
                            )} OFF`}
                      </p>
                    </div>

                    {!appliedCoupon.isProgressReward && (
                      <button
                        type="button"
                        onClick={
                          removeCoupon
                        }
                        className="text-xs text-stone transition-colors hover:text-mango"
                      >
                        REMOVE
                      </button>
                    )}
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
                            .replace(
                              /\s+/g,
                              ""
                            )
                        );

                        setCouponError(null);
                      }}
                      onKeyDown={(event) => {
                        if (
                          event.key ===
                          "Enter"
                        ) {
                          event.preventDefault();
                          applyCouponCode(
                            couponCode
                          );
                        }
                      }}
                      placeholder="ENTER CODE"
                      className="min-w-0 flex-1 border border-line-strong bg-transparent px-4 py-3 text-sm text-bone placeholder:text-stone-dark focus:border-bone focus:outline-none"
                    />

                    <button
                      type="button"
                      onClick={() =>
                        applyCouponCode(
                          couponCode
                        )
                      }
                      disabled={
                        couponLoading
                      }
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
                  availableCoupons.length >
                    0 && (
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
                                key={
                                  coupon.code
                                }
                                className="flex items-center justify-between border border-line px-3 py-3"
                              >
                                <div>
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
                  availableCoupons.length ===
                    0 && (
                    <p className="mt-2 text-xs text-stone-dark">
                      Loading available coupons…
                    </p>
                  )}
              </div>

              {/* TOTALS */}

              <div className="flex flex-col gap-3 text-sm tabular-nums">
                <div className="flex justify-between text-stone">
                  <span>Subtotal</span>

                  <span>
                    {formatPrice(
                      currentSubtotal
                    )}
                  </span>
                </div>

                {productDiscount > 0 && (
                  <div className="flex justify-between border-b border-mango/20 pb-2 text-mango">
                    <div className="flex flex-col gap-1">
                      <span className="text-sm font-semibold">
                        You save on product discounts
                      </span>

                      <span className="text-xs text-mango/70">
                        Already included in the subtotal ·{" "}
                        {
                          lines.filter(
                            (l) =>
                              getProductSavingsAmount(l.product) > 0
                          ).length
                        }{" "}
                        item(s) with discount
                      </span>
                    </div>

                    <span className="text-sm font-semibold">
                      {formatPrice(
                        productDiscount
                      )}
                    </span>
                  </div>
                )}

                {discount > 0 && (
                  <div className="flex justify-between text-mango">
                    <div className="flex flex-col gap-1">
                      <span>
                        Coupon Discount
                      </span>

                      {appliedCoupon && (
                        <span className="text-[11px] text-mango/70">
                          {
                            appliedCoupon.code
                          }{" "}
                          (
                          {appliedCoupon.discountType ===
                          "percentage"
                            ? `${appliedCoupon.discountValue}%`
                            : formatPrice(
                                appliedCoupon.discountValue
                              )}
                          )
                        </span>
                      )}
                    </div>

                    <span>
                      -
                      {formatPrice(
                        discount
                      )}
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
                        : formatPrice(
                            shipping
                          )}
                  </span>
                </div>

                <div className="hairline my-1" />

                <div className="flex justify-between text-base font-bold text-bone">
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
