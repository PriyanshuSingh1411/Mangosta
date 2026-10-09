import type { Metadata } from "next";
import LegalPage, { LegalLink } from "@/app/components/legal/LegalPage";
import BusinessContact from "@/app/components/legal/BusinessContact";
import { getStoreConfig } from "@/app/lib/storeConfig";
import { getCheckoutSettings, MAX_OPEN_UNPAID_ORDERS } from "@/app/lib/dataStore";
import { formatPrice, MAX_PER_SIZE_PER_ORDER } from "@/app/data/productTypes";
import { SUPPORT_WHATSAPP_DISPLAY } from "@/app/data/storeTypes";
import { jsonLdString } from "@/app/lib/jsonLd";

export const metadata: Metadata = {
  title: "FAQ",
  description: "Answers about orders, payment, delivery, returns, sizing and your MANGOSTA account.",
  alternates: { canonical: "/faq" },
};

export const dynamic = "force-dynamic";

type Faq = {
  q: string;
  /** Plain text (also used for search engines). */
  a: string;
  link?: { href: string; label: string };
};

type FaqGroup = { id: string; title: string; items: Faq[] };

export default async function FaqPage() {
  const [business, returns, delivery, checkout] = await Promise.all([
    getStoreConfig("businessDetails"),
    getStoreConfig("returnsPolicy"),
    getStoreConfig("delivery"),
    getCheckoutSettings(),
  ]);

  const deliveryDays =
    delivery.enabled && delivery.deliverEverywhere
      ? `Most orders arrive in ${delivery.defaultMinDays}–${delivery.defaultMaxDays} days. `
      : "";
  const freeShipping =
    checkout.enabled && checkout.freeShippingEnabled && checkout.freeShippingThreshold > 0
      ? ` Orders of ${formatPrice(checkout.freeShippingThreshold)} or more ship free.`
      : "";
  const returnTypes = [
    returns.allowReturns ? "return" : "",
    returns.allowExchanges ? "exchange" : "",
  ].filter(Boolean);
  const returnsOpen = returns.enabled && returnTypes.length > 0;

  const groups: FaqGroup[] = [
    {
      id: "orders",
      title: "Orders and payment",
      items: [
        {
          q: "How do I place an order?",
          a: "Add the pieces you like to your bag and go to checkout. You need to be signed in to order. Signing in only takes a moment: we email you a 6-digit code, and there's no password to remember.",
        },
        {
          q: "Which payment methods can I use?",
          a: "The options for your order are shown at checkout. Cash on delivery is available wherever your PIN code allows it: you pay the courier when your order arrives.",
        },
        {
          q: "Will I get an order confirmation?",
          a: "Yes. We email you as soon as your order is placed, and again when it ships and when it's delivered. You can also follow every order on your Orders page.",
          link: { href: "/orders", label: "Your orders" },
        },
        {
          q: "Can I cancel my order?",
          a: "Yes, while it's still processing. Open the order on your Orders page and choose Cancel. Once an order has shipped, it can no longer be cancelled, but you can return it after delivery if returns are open for it.",
        },
        {
          q: "Is there a limit on how much I can order?",
          a: `You can buy up to ${MAX_PER_SIZE_PER_ORDER} of each size of a product in one order, and have up to ${MAX_OPEN_UNPAID_ORDERS} unpaid orders being processed at a time.`,
        },
        {
          q: "How do coupons work?",
          a: "Enter the code at checkout. One coupon or reward can be used per order, and each one has its own rules (for example a minimum order value or first orders only), which are shown when you apply it.",
        },
      ],
    },
    {
      id: "delivery",
      title: "Shipping and delivery",
      items: [
        {
          q: "How long does delivery take?",
          a: `${deliveryDays}Enter your PIN code on any product page to see the estimated delivery date for your area.`,
        },
        {
          q: "How much is shipping?",
          a: `The shipping charge, if any, is shown at checkout before you place your order.${freeShipping}`,
        },
        {
          q: "How do I track my order?",
          a: "Once your order ships, its page shows the courier and tracking number, and we email them to you too.",
          link: { href: "/orders", label: "Your orders" },
        },
        {
          q: "Do you deliver to my PIN code?",
          a: "We deliver within India. The PIN code check on product pages tells you whether we deliver to you and whether cash on delivery is available there.",
        },
      ],
    },
    {
      id: "returns",
      title: "Returns and exchanges",
      items: returnsOpen
        ? [
            {
              q: "What is your return policy?",
              a: `You can ask to ${returnTypes.join(" or ")} items within ${returns.windowDays} days of delivery. ${returns.policyText}`.trim(),
            },
            {
              q: `How do I ${returnTypes.join(" or ")} an item?`,
              a: "Open the delivered order on your Orders page, choose the items and tell us why. You can follow the request, and any notes from us about the next steps, on the same page.",
              link: { href: "/orders", label: "Your orders" },
            },
            ...(returns.allowReturns
              ? [
                  {
                    q: "How much will I get back?",
                    a: "What you actually paid for the returned items: their price minus their share of any coupon or reward discount used on the order. Shipping is refunded only when the whole order is returned. You can see the amount on your return request.",
                  },
                ]
              : []),
            ...(returns.allowExchanges
              ? [
                  {
                    q: "Can I exchange for a different size or colour?",
                    a: "Yes, if the size or colour you want is in stock. It's reserved for you when we approve the exchange.",
                  },
                ]
              : []),
            {
              q: "My item arrived damaged or wrong. What do I do?",
              a: "We're sorry! Request a return or exchange from the order page and choose the reason that fits, or contact us, and we'll put it right.",
            },
          ]
        : [
            {
              q: "Can I return or exchange an item?",
              a: "Returns and exchanges aren't available at the moment. If an item arrives damaged, defective or different from what you ordered, contact us and we'll put it right.",
            },
          ],
    },
    {
      id: "products",
      title: "Sizing and products",
      items: [
        {
          q: "How do I find my size?",
          a: "Use the size guide on the product page, which lists the measurements for each size. You can also save your usual size and measurements in your size profile on your Account page.",
        },
        {
          q: "The size I want is sold out. Will it come back?",
          a: "Choose the size and tap 'Notify me'. We'll email you once when it's back in stock. If you're not signed in, we first send a link to confirm your email.",
        },
        {
          q: "Who can write reviews?",
          a: "Only customers who received the product, so every review comes from a real buyer.",
        },
      ],
    },
    {
      id: "account",
      title: "Account and privacy",
      items: [
        {
          q: "Do I need a password?",
          a: "No. You sign in with a 6-digit code that we email you each time. It expires after 10 minutes.",
        },
        {
          q: "How do I stop marketing emails?",
          a: "Use the unsubscribe link at the bottom of any marketing email, or untick the box on your Account page. Emails about your orders and account are still sent.",
        },
        {
          q: "How do I delete my account?",
          a: "Go to your Account page and use 'Delete account' at the bottom. We email you a code to confirm. Records of past orders and returns are kept as the law requires, but they no longer belong to an account.",
          link: { href: "/account", label: "Your account" },
        },
        {
          q: "How do you use my data?",
          a: "Only to run the shop: delivering orders, your account, support and, if you agree, our newsletter. We never sell it. Read the details in our Privacy Policy.",
          link: { href: "/privacy", label: "Privacy Policy" },
        },
      ],
    },
    {
      id: "contact",
      title: "Contact",
      items: [
        {
          q: "How can I contact you?",
          a: `Email us at ${business.email}${business.phone ? ` or call ${business.phone}` : ""}. For help with an order, open the order and use 'Chat on WhatsApp' (${SUPPORT_WHATSAPP_DISPLAY}), or open a request on the Support page when you're signed in.`,
          link: { href: "/support", label: "Support" },
        },
      ],
    },
  ];

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: groups.flatMap((group) =>
      group.items.map((item) => ({
        "@type": "Question",
        name: item.q,
        acceptedAnswer: { "@type": "Answer", text: item.a },
      }))
    ),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(jsonLd) }} />
      <LegalPage
        eyebrow="MANGOSTA / HELP"
        title="FAQ"
        intro={
          <p>
            Quick answers about orders, delivery, returns and your account. Can’t find what you need? Get in touch at
            the bottom of this page.
          </p>
        }
        sections={groups.map((group) => ({
          id: group.id,
          title: group.title,
          body: (
            <div className="divide-y divide-line border-y border-line">
              {group.items.map((item) => (
                <details key={item.q} className="group py-1">
                  <summary className="flex cursor-pointer list-none items-start justify-between gap-4 py-3 text-bone marker:hidden [&::-webkit-details-marker]:hidden">
                    <span className="text-sm font-medium sm:text-[15px]">{item.q}</span>
                    <span
                      aria-hidden="true"
                      className="mt-0.5 font-mono text-sm text-stone transition-transform group-open:rotate-45"
                    >
                      +
                    </span>
                  </summary>
                  <div className="pb-4 pr-8 text-sm leading-7 text-bone-dim">
                    <p>{item.a}</p>
                    {item.link && (
                      <p className="mt-2">
                        <LegalLink href={item.link.href}>{item.link.label} →</LegalLink>
                      </p>
                    )}
                  </div>
                </details>
              ))}
            </div>
          ),
        }))}
      >
        <section className="py-10">
          <p className="label-technical mb-4 text-stone">STILL NEED HELP?</p>
          <BusinessContact details={business} showGrievanceOfficer={false} />
          <p className="mt-6 text-xs text-stone">
            See also our <LegalLink href="/terms">Terms &amp; Conditions</LegalLink> and{" "}
            <LegalLink href="/privacy">Privacy Policy</LegalLink>.
          </p>
        </section>
      </LegalPage>
    </>
  );
}
