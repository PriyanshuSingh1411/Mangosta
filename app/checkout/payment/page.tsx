"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";

import Navigation from "@/app/components/Navigation";
import ProductPlaceholderArt from "@/app/components/ProductPlaceholderArt";
import { useCartStore } from "@/app/store/useCartStore";
import { formatPrice } from "@/app/data/productTypes";

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

export default function PaymentPage() {
  const {
    lines,
    subtotal,
    clearCart,
  } = useCartStore();

  const [checkoutData, setCheckoutData] =
    useState<CheckoutData | null>(null);

  const [paymentMethod, setPaymentMethod] =
    useState<PaymentMethod>("cod");

  const [isSubmitting, setIsSubmitting] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  const [placed, setPlaced] =
    useState(false);

  const [failedLines, setFailedLines] =
    useState<Set<string>>(new Set());

  /*
   * --------------------------------------------------------------------------
   * Load checkout information
   * --------------------------------------------------------------------------
   */

  useEffect(() => {
    try {
      const saved =
        sessionStorage.getItem(
          "mangosta-checkout"
        );

      if (!saved) {
        window.location.href =
          "/checkout";

        return;
      }

      const parsed =
        JSON.parse(saved);

      setCheckoutData(parsed);
    } catch {
      window.location.href =
        "/checkout";
    }
  }, []);

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
                  line.product.price,
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
        throw new Error(
          data?.error ||
            "Unable to place your order."
        );
      }

      /*
       * Order successfully created.
       */

      clearCart();

      sessionStorage.removeItem(
        "mangosta-checkout"
      );

      /*
       * If API returns order ID,
       * go directly to order details.
       */

      if (data?.order?.id) {
        window.location.href =
          `/orders/${encodeURIComponent(
            data.order.id
          )}`;

        return;
      }

      if (data?.orderId) {
        window.location.href =
          `/orders/${encodeURIComponent(
            data.orderId
          )}`;

        return;
      }

      /*
       * Fallback confirmation.
       */

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
            href="/orders"
            className="border border-line-strong px-6 py-3 text-xs tracking-[0.15em] text-bone transition-colors hover:border-mango hover:text-mango"
          >
            VIEW YOUR ORDERS
          </Link>

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

      <main className="min-h-screen bg-void px-6 pb-20 pt-28 sm:px-10 lg:px-12">

        <div className="mx-auto max-w-7xl">

          {/* HEADER */}

          <div className="mb-10">

            <p className="label-technical mb-3">
              CHECKOUT / PAYMENT
            </p>

            <h1 className="font-display text-4xl tracking-tight text-bone sm:text-5xl">
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
                    setPaymentMethod("cod")
                  }
                  className={`flex w-full items-center justify-between border p-5 text-left transition-all ${
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
                        Pay when your
                        order arrives.
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

              <div className="flex flex-col gap-3 font-mono text-sm">

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

                <div className="flex justify-between text-base text-bone">

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