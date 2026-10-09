"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useIsClient } from "@/app/lib/useBrowserValue";
import Link from "next/link";
import Image from "next/image";

import Navigation from "@/app/components/Navigation";
import { useAuth } from "@/app/components/AuthProvider";
import ProductPlaceholderArt from "@/app/components/ProductPlaceholderArt";
import { useCartStore } from "@/app/store/useCartStore";
import {
  formatPrice,
  getProductSalePrice,
  getProductStrikethroughPrice,
  getProductSavingsPercent,
} from "@/app/data/productTypes";
type PaymentMethod =
  | "cod"
  | "online"
  | "card";

type CheckoutData = {
  customer: {
    email: string;
    firstName: string;
    lastName: string;
    mobile: string;
    address: string;
    city: string;
    state: string;
    postalCode: string;
  };

  couponCode: string;
  discount: number;
  shipping: number;
  total: number;
};

/** The checkout details saved by the shipping step, or null. */
function readSavedCheckout(): CheckoutData | null {
  try {
    const saved = sessionStorage.getItem("mangosta-checkout");
    return saved ? (JSON.parse(saved) as CheckoutData) : null;
  } catch {
    return null;
  }
}

export default function PaymentPage() {
  const { openAuth } = useAuth();

  const {
    lines,
    subtotal,
    clearCartAfterOrder,
  } = useCartStore();

  const router = useRouter();

  // The details saved by the shipping step (sessionStorage), read once in
  // the browser right after hydration: undefined until then, null when
  // nothing usable was saved. Kept in state, so removing them after the
  // order is placed doesn't change what this page shows.
  const isClient = useIsClient();
  const [checkoutData, setCheckoutData] = useState<CheckoutData | null | undefined>(undefined);

  if (isClient && checkoutData === undefined) {
    setCheckoutData(readSavedCheckout());
  }

  const [paymentMethod, setPaymentMethod] =
    useState<PaymentMethod>("cod");

  const [isSubmitting, setIsSubmitting] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  const [placed, setPlaced] =
    useState(false);

  const [placedOrderId, setPlacedOrderId] =
    useState<string | null>(null);

  const [failedLines, setFailedLines] =
    useState<Set<string>>(new Set());

  // Admin → Delivery: is cash on delivery allowed for this PIN code?
  const [codAvailable, setCodAvailable] =
    useState(true);

  /*
   * --------------------------------------------------------------------------
   * Load checkout information
   * --------------------------------------------------------------------------
   */

  useEffect(() => {
    void useCartStore.getState().syncProducts();
  }, []);

  useEffect(() => {
    if (checkoutData === undefined) return; // not read yet

    // Nothing from the shipping step (or unreadable): start checkout again.
    if (!checkoutData) {
      router.replace("/checkout");
      return;
    }

    let cancelled = false;
    const pincode = String(checkoutData.customer?.postalCode ?? "");

    fetch(`/api/delivery/check?pincode=${encodeURIComponent(pincode)}`, { cache: "no-store" })
      .then((response) => response.json())
      .then((delivery) => {
        if (cancelled) return;
        if (delivery?.enabled && delivery.valid && !delivery.cod) {
          setCodAvailable(false);
          setPaymentMethod((current) => (current === "cod" ? "online" : current));
        }
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, [checkoutData, router]);

  /*
   * --------------------------------------------------------------------------
   * Place order
   * --------------------------------------------------------------------------
   */

  const handlePlaceOrder = async () => {
    if (!checkoutData) {
      return;
    }

    if (lines.length === 0) {
      setError(
        "Your bag is empty."
      );

      return;
    }

    setError(null);
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
            customer:
              checkoutData.customer,

            lines: lines.map(
              (line) => ({
                lineId:
                  line.lineId,

                productId:
                  line.product.id,

                productName:
                  line.product.name,

                slug:
                  line.product.slug,

                image:
                  line.product
                    .images[0] || "",

                size:
                  line.size,

                color:
                  line.color,

                quantity:
                  line.quantity,

                price:
                  getProductSalePrice(line.product),
              })
            ),

            couponCode:
              checkoutData.couponCode,

            paymentMethod,
          }),
        }
      );

      const data =
        await response
          .json()
          .catch(() => ({}));

      if (!response.ok) {
        // Signed out (e.g. the session ended): open sign-in; after it the
        // customer just presses the button again.
        if (response.status === 401) {
          openAuth("signin");
        }

        throw new Error(
          data?.error ||
            "Unable to place your order."
        );
      }

      /*
       * Order successfully created.
       * Show the confirmation modal first instead of
       * immediately redirecting to the order details page.
       */

 const orderId =
  data?.order?.id || data?.orderId || null;

setPlacedOrderId(orderId);

// The purchase event is recorded by the server when the order is created
// (POST /api/checkout), so it is never lost or counted twice.

clearCartAfterOrder();

      sessionStorage.removeItem(
        "mangosta-checkout"
      );

      setPlaced(true);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong while placing the order."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  /*
   * --------------------------------------------------------------------------
   * Loading
   * --------------------------------------------------------------------------
   */

  if (!checkoutData) {
    return (
      <>
        <Navigation />

        <main className="flex min-h-screen items-center justify-center bg-void">
          <p className="label-technical text-stone">
            LOADING PAYMENT…
          </p>
        </main>
      </>
    );
  }

  /*
   * --------------------------------------------------------------------------
   * Confirmation
   * --------------------------------------------------------------------------
   */

  if (placed) {
    return (
      <>
        <Navigation />

        <main className="relative flex min-h-screen items-center justify-center bg-void px-6 py-28 text-center">
          <div className="pointer-events-none absolute inset-0 bg-bone/[0.02]" />

          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="order-confirmed-title"
            className="relative w-full max-w-lg border border-line-strong bg-charcoal p-8 shadow-2xl sm:p-10"
          >
            <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-full border border-mango/50 text-mango">
              <span className="text-xl">✓</span>
            </div>

            <p className="label-technical mb-3 text-mango">
              ORDER CONFIRMED
            </p>

            <h1
              id="order-confirmed-title"
              className="type-title text-bone"
            >
              Thank you.
            </h1>

            <p className="mx-auto mt-4 max-w-md text-sm leading-relaxed text-stone">
              Your payment was successful and your order has been placed.
              {placedOrderId && (
                <>
                  <br />
                  <span className="mt-2 inline-block font-mono text-xs text-stone-dark">
                    ORDER — {placedOrderId}
                  </span>
                </>
              )}
            </p>

            <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Link
                href="/shop"
                className="border border-line-strong px-6 py-4 text-xs font-medium tracking-[0.15em] text-bone transition-colors hover:border-bone hover:bg-bone hover:text-void"
              >
                CONTINUE SHOPPING
              </Link>

              <Link
                href={
                  placedOrderId
                    ? `/orders/${encodeURIComponent(placedOrderId)}`
                    : "/orders"
                }
                className="bg-bone px-6 py-4 text-xs font-medium tracking-[0.15em] text-void transition-colors hover:bg-mango"
              >
                YOUR ORDER
              </Link>
            </div>
          </div>
        </main>
      </>
    );
  }

  /*
   * --------------------------------------------------------------------------
   * Payment page
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
              CHECKOUT / PAYMENT
            </p>

            <h1 className="type-title text-bone">
              Choose your payment.
            </h1>

            <p className="mt-3 text-sm text-stone">
              Select how you want to pay
              for your MANGOSTA order.
            </p>

          </div>

          <div className="grid grid-cols-1 gap-12 lg:grid-cols-[1.15fr_0.85fr] lg:gap-16">

            {/* ================================================================
               PAYMENT OPTIONS
               ================================================================ */}

            <section>

              <p className="label-technical mb-5">
                PAYMENT METHOD
              </p>

              <div className="flex flex-col gap-3">

                {/* ============================================================
                   COD
                   ============================================================ */}

                <button
                  type="button"
                  onClick={() =>
                    codAvailable && setPaymentMethod("cod")
                  }
                  disabled={!codAvailable}
                  className={`flex w-full items-center justify-between border p-5 text-left transition-all disabled:cursor-not-allowed disabled:opacity-40 ${
                    paymentMethod === "cod"
                      ? "border-bone bg-charcoal"
                      : "border-line-strong hover:border-stone"
                  }`}
                >

                  <div className="flex items-center gap-4">

                    <span
                      className={`flex h-5 w-5 items-center justify-center rounded-full border ${
                        paymentMethod ===
                        "cod"
                          ? "border-bone"
                          : "border-stone"
                      }`}
                    >
                      {paymentMethod ===
                        "cod" && (
                        <span className="h-2.5 w-2.5 rounded-full bg-bone" />
                      )}
                    </span>

                    <div>

                      <p className="text-sm font-medium text-bone">
                        CASH ON DELIVERY
                      </p>

                      <p className="mt-1 text-xs text-stone">
                        {codAvailable
                          ? "Pay when your order arrives."
                          : "Not available for your PIN code."}
                      </p>

                    </div>

                  </div>

                  <span className="label-technical text-stone">
                    COD
                  </span>

                </button>

                {/* ============================================================
                   ONLINE PAYMENT
                   ============================================================ */}

                <button
                  type="button"
                  onClick={() =>
                    setPaymentMethod(
                      "online"
                    )
                  }
                  className={`flex w-full items-center justify-between border p-5 text-left transition-all ${
                    paymentMethod ===
                    "online"
                      ? "border-bone bg-charcoal"
                      : "border-line-strong hover:border-stone"
                  }`}
                >

                  <div className="flex items-center gap-4">

                    <span
                      className={`flex h-5 w-5 items-center justify-center rounded-full border ${
                        paymentMethod ===
                        "online"
                          ? "border-bone"
                          : "border-stone"
                      }`}
                    >
                      {paymentMethod ===
                        "online" && (
                        <span className="h-2.5 w-2.5 rounded-full bg-bone" />
                      )}
                    </span>

                    <div>

                      <p className="text-sm font-medium text-bone">
                        ONLINE PAYMENT
                      </p>

                      <p className="mt-1 text-xs text-stone">
                        UPI, Net Banking
                        & Wallets
                      </p>

                    </div>

                  </div>

                  <span className="label-technical text-stone">
                    ONLINE
                  </span>

                </button>

                {/* ============================================================
                   CARD
                   ============================================================ */}

                <button
                  type="button"
                  onClick={() =>
                    setPaymentMethod(
                      "card"
                    )
                  }
                  className={`flex w-full items-center justify-between border p-5 text-left transition-all ${
                    paymentMethod === "card"
                      ? "border-bone bg-charcoal"
                      : "border-line-strong hover:border-stone"
                  }`}
                >

                  <div className="flex items-center gap-4">

                    <span
                      className={`flex h-5 w-5 items-center justify-center rounded-full border ${
                        paymentMethod ===
                        "card"
                          ? "border-bone"
                          : "border-stone"
                      }`}
                    >
                      {paymentMethod ===
                        "card" && (
                        <span className="h-2.5 w-2.5 rounded-full bg-bone" />
                      )}
                    </span>

                    <div>

                      <p className="text-sm font-medium text-bone">
                        PAY WITH CARD
                      </p>

                      <p className="mt-1 text-xs text-stone">
                        Credit or Debit
                        Card
                      </p>

                    </div>

                  </div>

                  <span className="label-technical text-stone">
                    CARD
                  </span>

                </button>

              </div>

              {/* ================================================================
                 SELECTED PAYMENT INFORMATION
                 ================================================================ */}

              <div className="mt-6 border border-line bg-charcoal p-5">

                {paymentMethod ===
                  "cod" && (
                  <>
                    <p className="label-technical mb-3">
                      CASH ON DELIVERY
                    </p>

                    <p className="text-sm leading-relaxed text-stone">
                      Pay the delivery
                      amount when your
                      order reaches your
                      address.
                    </p>
                  </>
                )}

                {paymentMethod ===
                  "online" && (
                  <>
                    <p className="label-technical mb-3">
                      ONLINE PAYMENT
                    </p>

                    <p className="text-sm leading-relaxed text-stone">
                      Pay securely using
                      UPI, net banking or
                      supported wallets.
                    </p>
                  </>
                )}

                {paymentMethod ===
                  "card" && (
                  <>
                    <p className="label-technical mb-3">
                      CARD PAYMENT
                    </p>

                    <p className="text-sm leading-relaxed text-stone">
                      Pay securely using
                      your credit or debit
                      card.
                    </p>
                  </>
                )}

              </div>

              {/* ================================================================
                 ERROR
                 ================================================================ */}

              {error && (
                <div className="mt-6 border border-mango/40 bg-mango/5 px-4 py-3">

                  <p
                    role="alert"
                    className="text-sm text-mango"
                  >
                    {error}
                  </p>

                </div>
              )}

              {/* ================================================================
                 PLACE ORDER
                 ================================================================ */}

              <button
                type="button"
                onClick={handlePlaceOrder}
                disabled={isSubmitting}
                className="mt-6 w-full bg-bone py-4 text-center text-xs font-medium tracking-[0.2em] text-void transition-colors hover:bg-mango disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSubmitting
                  ? "PLACING ORDER…"
                  : `PLACE ORDER — ${formatPrice(
                      checkoutData.total
                    )}`}
              </button>

              <p className="mt-3 text-center text-[11px] leading-relaxed text-stone">
                By placing your order, you agree to our{" "}
                <Link href="/terms" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-bone">
                  Terms
                </Link>{" "}
                and{" "}
                <Link href="/privacy" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-bone">
                  Privacy Policy
                </Link>
                .
              </p>

              <Link
                href="/checkout"
                className="mt-3 block text-center text-xs tracking-[0.12em] text-stone transition-colors hover:text-bone"
              >
                ← BACK TO SHIPPING
              </Link>

            </section>

            {/* ================================================================
               ORDER SUMMARY
               ================================================================ */}

            <aside className="h-fit border border-line bg-charcoal p-6 sm:p-8">

              <p className="label-technical mb-6">
                ORDER SUMMARY
              </p>

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
                          {line.product.name}
                        </p>

                        <p className="mt-1 text-xs text-stone">
                          {line.color} /{" "}
                          {line.size} ×{" "}
                          {line.quantity}
                        </p>

                      </div>

                      <div className="text-right">
                        {getProductStrikethroughPrice(line.product) !== null && (
                          <p className="font-body tabular-nums text-[10px] text-stone-dark line-through">
                            {formatPrice(
                              (getProductStrikethroughPrice(line.product) ?? 0) *
                                line.quantity
                            )}
                          </p>
                        )}
                        <p className="type-price text-xs text-bone-dim">
                          {formatPrice(
                            getProductSalePrice(line.product) * line.quantity
                          )}
                        </p>
                        {getProductSavingsPercent(line.product) !== null && (
                          <p className="mt-1 inline-block rounded-sm bg-mango/10 px-1.5 py-[3px] text-[10px] font-semibold uppercase leading-none tracking-[0.08em] text-mango">
                            Save {getProductSavingsPercent(line.product)}%
                          </p>
                        )}
                      </div>

                    </div>

                  </li>
                ))}

              </ul>

              <div className="hairline my-6" />

              {/* COUPON */}

              {checkoutData.couponCode && (
                <div className="mb-6 flex items-center justify-between border border-line px-4 py-3">

                  <span className="label-technical">
                    COUPON
                  </span>

                  <span className="font-mono text-xs text-mango">
                    {checkoutData.couponCode}
                  </span>

                </div>
              )}

              {/* PRICE */}

              <div className="flex flex-col gap-3 text-sm tabular-nums">

                <div className="flex justify-between text-stone">

                  <span>
                    Subtotal
                  </span>

                  <span>
                    {formatPrice(
                      subtotal()
                    )}
                  </span>

                </div>

                {checkoutData.discount >
                  0 && (
                  <div className="flex justify-between text-mango">

                    <span>
                      Discount
                    </span>

                    <span>
                      -
                      {formatPrice(
                        checkoutData.discount
                      )}
                    </span>

                  </div>
                )}

                <div className="flex justify-between text-stone">

                  <span>
                    Shipping
                  </span>

                  <span>
                    {checkoutData.shipping ===
                    0
                      ? "FREE"
                      : formatPrice(
                          checkoutData.shipping
                        )}
                  </span>

                </div>

                <div className="hairline my-1" />

                <div className="flex justify-between text-base font-bold text-bone">

                  <span>
                    Total
                  </span>

                  <span>
                    {formatPrice(
                      checkoutData.total
                    )}
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