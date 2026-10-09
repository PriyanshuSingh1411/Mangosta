import type { Metadata } from "next";
import LegalPage, { LegalLink, LegalList, POLICIES_LAST_UPDATED } from "@/app/components/legal/LegalPage";
import BusinessContact, { grievanceEmail } from "@/app/components/legal/BusinessContact";
import { getStoreConfig } from "@/app/lib/storeConfig";
import { getCheckoutSettings, MAX_OPEN_UNPAID_ORDERS } from "@/app/lib/dataStore";
import { formatPrice, MAX_PER_SIZE_PER_ORDER } from "@/app/data/productTypes";

export const metadata: Metadata = {
  title: "Terms & Conditions",
  description: "The terms for shopping at MANGOSTA: orders, payment, delivery, returns and your account.",
  alternates: { canonical: "/terms" },
};

export const dynamic = "force-dynamic";

export default async function TermsPage() {
  const [business, returns, delivery, checkout] = await Promise.all([
    getStoreConfig("businessDetails"),
    getStoreConfig("returnsPolicy"),
    getStoreConfig("delivery"),
    getCheckoutSettings(),
  ]);

  const brand = business.legalName ? `MANGOSTA (${business.legalName})` : "MANGOSTA";
  const complaintsEmail = grievanceEmail(business);
  const courts = business.jurisdictionCity
    ? `the courts at ${business.jurisdictionCity}`
    : "the courts where our business is registered";
  const freeShipping =
    checkout.enabled && checkout.freeShippingEnabled && checkout.freeShippingThreshold > 0
      ? ` Orders of ${formatPrice(checkout.freeShippingThreshold)} or more ship free.`
      : "";
  const returnTypes = [
    returns.allowReturns ? "return" : "",
    returns.allowExchanges ? "exchange" : "",
  ].filter(Boolean);

  return (
    <LegalPage
      eyebrow="MANGOSTA / LEGAL"
      title="TERMS & CONDITIONS"
      updated={POLICIES_LAST_UPDATED}
      intro={
        <p>
          These terms apply when you use this website or buy from {brand} (“we”, “us”). By using the site or placing
          an order, you agree to them. Please also read our <LegalLink href="/privacy">Privacy Policy</LegalLink>.
          Nothing in these terms affects your rights as a consumer under Indian law.
        </p>
      }
      sections={[
        {
          id: "account",
          title: "Your account",
          body: (
            <>
              <p>
                You sign in with a one-time code sent to your email. Keep access to that email secure: anyone who can read
                it can sign in to your account. Please give accurate details (name, email, mobile number and address) so
                we can deliver your orders.
              </p>
              <p>
                You can delete your account at any time from your <LegalLink href="/account">Account</LegalLink> page once
                no order or return is still in progress. We may suspend accounts that are used for fraud or misuse.
              </p>
            </>
          ),
        },
        {
          id: "products-prices",
          title: "Products and prices",
          body: (
            <>
              <p>
                We describe and photograph products as accurately as we can. Colours can look slightly different on
                different screens. Please check the size guide on each product page before ordering.
              </p>
              <p>
                Prices are in Indian Rupees (₹). The total you pay, including any shipping charge and discount, is shown
                at checkout before you place your order. If a product is shown at a clearly wrong price because of an
                error, we may cancel the order and refund anything you paid.
              </p>
            </>
          ),
        },
        {
          id: "orders",
          title: "Orders",
          body: (
            <>
              <p>
                When you place an order, you’ll receive an order confirmation by email. We may cancel an order (and refund
                anything paid) if an item turns out to be unavailable, the price was wrong, the address can’t be delivered
                to, or we suspect fraud. We’ll tell you if we do.
              </p>
              <LegalList
                items={[
                  `You can buy up to ${MAX_PER_SIZE_PER_ORDER} of each size of a product in one order.`,
                  `An account can have up to ${MAX_OPEN_UNPAID_ORDERS} unpaid orders being processed at a time.`,
                  "You can cancel an order yourself from its order page while it’s still processing (before it ships).",
                ]}
              />
            </>
          ),
        },
        {
          id: "payment",
          title: "Payment",
          body: (
            <p>
              The payment methods available for your order are shown at checkout. Cash on delivery is available where
              your PIN code allows it, and you pay the courier when the order arrives. We never ask for or store card
              details on this site.
            </p>
          ),
        },
        {
          id: "delivery",
          title: "Shipping and delivery",
          body: (
            <>
              <p>
                We deliver within India. Enter your PIN code on a product page to see the estimated delivery date and
                whether cash on delivery is available there.
                {delivery.enabled && delivery.deliverEverywhere
                  ? ` Most orders arrive in ${delivery.defaultMinDays}–${delivery.defaultMaxDays} days.`
                  : ""}
                {freeShipping}
              </p>
              <p>
                Delivery dates are estimates. Once your order ships, its order page shows the courier and tracking
                number. If an order can’t be delivered and comes back to us, we’ll cancel it and let you know.
              </p>
            </>
          ),
        },
        {
          id: "returns",
          title: "Returns, exchanges and refunds",
          body: returns.enabled && returnTypes.length > 0 ? (
            <>
              <p>
                You can ask to {returnTypes.join(" or ")} items within {returns.windowDays} days of delivery from the order’s
                page. {returns.policyText}
              </p>
              <LegalList
                items={[
                  ...(returns.allowReturns
                    ? [
                        "A refund is what you actually paid for the returned items: their price minus their share of any coupon or reward discount used on the order.",
                        "Shipping is refunded only when the whole order is returned.",
                      ]
                    : []),
                  ...(returns.allowExchanges
                    ? ["Exchanges depend on the size or colour you want being in stock when the request is approved."]
                    : []),
                  "If an item arrives damaged, defective or different from what you ordered, tell us and we’ll put it right.",
                ]}
              />
            </>
          ) : (
            <p>
              Returns and exchanges aren’t available at the moment. If an item arrives damaged, defective or different
              from what you ordered, contact us and we’ll put it right.
            </p>
          ),
        },
        {
          id: "coupons",
          title: "Coupons and rewards",
          body: (
            <p>
              One coupon or reward can be used per order. Each coupon has its own rules (such as a minimum order value,
              dates, or first orders only), shown when you apply it. Coupons can’t be exchanged for cash, and a coupon used
              on an order that is cancelled is released again.
            </p>
          ),
        },
        {
          id: "content",
          title: "Reviews and other content",
          body: (
            <p>
              Reviews can only be written by customers who received the product. By posting a review, photo or question,
              you allow us to show it on the site. Don’t post anything unlawful, offensive or that isn’t yours to share. We
              may hide content that breaks these rules.
            </p>
          ),
        },
        {
          id: "site-use",
          title: "Using the site",
          body: (
            <p>
              The MANGOSTA name, logo, designs, photos and text on this site belong to us. Please don’t copy or use them
              without permission. Don’t misuse the site, for example by trying to break its security, overload it or
              collect other people’s data.
            </p>
          ),
        },
        {
          id: "liability",
          title: "Our responsibility",
          body: (
            <p>
              We’re responsible for the products we sell and for providing our service with reasonable care. As far as
              the law allows, we’re not responsible for losses we couldn’t reasonably foresee, or for delays caused by
              events outside our control (such as natural disasters or courier disruptions). This doesn’t limit your rights
              as a consumer.
            </p>
          ),
        },
        {
          id: "complaints-law",
          title: "Complaints and governing law",
          body: (
            <p>
              If something goes wrong, please contact us first at{" "}
              <LegalLink href={`mailto:${complaintsEmail}`}>{complaintsEmail}</LegalLink>. We acknowledge complaints
              within 48 hours and aim to resolve them within one month. These terms are governed by the laws of India,
              and {courts} have jurisdiction, without affecting your right to approach a consumer commission.
            </p>
          ),
        },
        {
          id: "changes",
          title: "Changes to these terms",
          body: (
            <p>
              We may update these terms from time to time. The version on this page when you place an order applies to
              that order.
            </p>
          ),
        },
        {
          id: "contact",
          title: "Contact",
          body: <BusinessContact details={business} />,
        },
      ]}
    />
  );
}
