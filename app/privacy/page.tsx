import type { Metadata } from "next";
import LegalPage, { LegalLink, LegalList, POLICIES_LAST_UPDATED } from "@/app/components/legal/LegalPage";
import BusinessContact, { grievanceEmail } from "@/app/components/legal/BusinessContact";
import { getStoreConfig } from "@/app/lib/storeConfig";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How MANGOSTA collects, uses and protects your personal data.",
  alternates: { canonical: "/privacy" },
};

export const dynamic = "force-dynamic";

export default async function PrivacyPage() {
  const business = await getStoreConfig("businessDetails");
  const brand = business.legalName ? `MANGOSTA (${business.legalName})` : "MANGOSTA";
  const complaintsEmail = grievanceEmail(business);

  return (
    <LegalPage
      eyebrow="MANGOSTA / LEGAL"
      title="PRIVACY POLICY"
      updated={POLICIES_LAST_UPDATED}
      intro={
        <p>
          This policy explains what personal data {brand} (“we”, “us”) collects when you use this website,
          why we use it, who we share it with and the choices you have. We handle personal data in line with
          India’s Digital Personal Data Protection Act, 2023 and the Information Technology Act, 2000.
        </p>
      }
      sections={[
        {
          id: "what-we-collect",
          title: "What we collect",
          body: (
            <>
              <LegalList
                items={[
                  <><span className="text-bone">Your account:</span> name, email address and mobile number, and, only if you add them, your date of birth and gender.</>,
                  <><span className="text-bone">Your orders:</span> the name, phone number, email and delivery address you give at checkout, what you ordered, amounts, payment method, and the status of the order, cancellations, returns and exchanges.</>,
                  <><span className="text-bone">Things you save:</span> saved addresses, your size profile (such as height, weight and usual size), your wishlist and the contents of your bag.</>,
                  <><span className="text-bone">Things you share:</span> reviews and review photos, questions about products and messages to customer support.</>,
                  <><span className="text-bone">Alerts and emails:</span> the email address you use for back-in-stock alerts or the newsletter.</>,
                  <><span className="text-bone">How you use the shop:</span> pages and products you view, searches, and items added to or removed from your bag. This is linked to your account when you’re signed in, and otherwise to a random browser id.</>,
                  <><span className="text-bone">Technical data:</span> your IP address and browser details, used to keep the site secure (for example to limit repeated sign-in attempts). IP addresses used for these limits are stored only in scrambled (hashed) form.</>,
                ]}
              />
              <p>
                We never ask for or store card details on this site. Cash on delivery is paid to the courier.
              </p>
            </>
          ),
        },
        {
          id: "how-we-use-it",
          title: "How we use it",
          body: (
            <LegalList
              items={[
                "To take, pack, deliver and track your orders, and to handle cancellations, returns, exchanges and refunds.",
                "To create your account and sign you in with one-time codes sent to your email (there are no passwords).",
                "To answer your questions and support requests.",
                "To send emails about your orders and account. These are always sent, because they’re part of the service.",
                "To send news and offers, only if you agreed (see “Emails” below).",
                "To show your reviews and questions on product pages, with your first name and last initial.",
                "To understand what’s popular and improve the shop, for example which products are viewed and what people search for.",
                "To keep the shop safe: preventing fraud, misuse and repeated sign-in or order attempts.",
                "To meet legal duties, such as keeping tax and accounting records.",
              ]}
            />
          ),
        },
        {
          id: "consent",
          title: "Consent and legal basis",
          body: (
            <p>
              We use your personal data with your consent, or where the law allows it without separate consent, for
              example to deliver an order you placed or to keep records the law requires. You can withdraw consent at any
              time (for example by unsubscribing from emails or deleting your account). This doesn’t affect anything done
              before you withdrew it.
            </p>
          ),
        },
        {
          id: "emails",
          title: "Emails",
          body: (
            <>
              <p>
                Order and account emails (codes, order updates, returns, deleting your account) are always sent.
              </p>
              <p>
                Marketing emails, such as the newsletter, offers and bag reminders, are sent only if you ticked the box in
                your <LegalLink href="/account">account</LegalLink> or confirmed your newsletter subscription from the
                link we emailed you. Every marketing email has an unsubscribe link, and you can also untick the box in your
                account at any time.
              </p>
            </>
          ),
        },
        {
          id: "sharing",
          title: "Who we share it with",
          body: (
            <>
              <p>We don’t sell your personal data. We share only what’s needed with:</p>
              <LegalList
                items={[
                  "Courier partners: your name, delivery address and phone number, to deliver your order or pick up a return.",
                  "Service providers that run the shop for us: website hosting, our database, image hosting (for product and review photos) and email delivery. They process data only on our instructions.",
                  "A payment provider, if you pay online.",
                  "Government or law-enforcement authorities, when the law requires it.",
                ]}
              />
            </>
          ),
        },
        {
          id: "cookies",
          title: "Cookies and browser storage",
          body: (
            <>
              <p>We use a small number of cookies and browser storage, and no advertising cookies.</p>
              <LegalList
                items={[
                  <><span className="font-mono text-xs text-bone">mangosta_session</span>: keeps you signed in (30 days, or until you sign out).</>,
                  <><span className="font-mono text-xs text-bone">mangosta_engagement_session</span>: a random id used for the shop statistics described above (30 days).</>,
                  "Browser storage on your device: your bag, recently viewed products, recent searches, the PIN code you last checked, notifications you’ve seen and display preferences such as light or dark mode. During checkout, your delivery details are kept in the browser tab until the order is placed or the tab is closed.",
                ]}
              />
              <p>
                You can clear these in your browser settings. If you do, you’ll be signed out and your bag on this device
                will be emptied.
              </p>
            </>
          ),
        },
        {
          id: "storage-security",
          title: "Where it’s stored and how it’s protected",
          body: (
            <p>
              Your data is stored with our service providers and may be held on servers outside India. Connections to
              the site are encrypted (HTTPS), sign-in codes and sessions are stored in scrambled (hashed) form, codes
              expire after 10 minutes, and only people who run the shop can see order details.
            </p>
          ),
        },
        {
          id: "retention",
          title: "How long we keep it",
          body: (
            <LegalList
              items={[
                "Your account and what’s saved in it: until you delete your account.",
                "Orders, returns and exchanges: as long as tax and accounting laws require (generally around six years), even after an account is deleted.",
                "Sign-in codes: 10 minutes.",
                "Shop statistics: kept to see trends over time. If you delete your account, they’re no longer linked to you or to your orders.",
                "Newsletter and back-in-stock alert sign-ups: until you delete your account. If you unsubscribe, we keep a note of your email address so that we don’t email you marketing again.",
              ]}
            />
          ),
        },
        {
          id: "your-rights",
          title: "Your rights",
          body: (
            <>
              <LegalList
                items={[
                  <><span className="text-bone">See and correct your data:</span> view and edit your profile, addresses and size profile on your <LegalLink href="/account">Account</LegalLink> page, or ask us for a summary of the data we hold.</>,
                  <><span className="text-bone">Delete your account:</span> use “Delete account” at the bottom of your Account page. We’ll remove your account and saved details, and your reviews stay up as “Verified buyer”. Order and return records are kept (with the name, email and address on them) but no longer belong to an account. If you later sign up again with the same email, your past orders will show in the new account.</>,
                  <><span className="text-bone">Withdraw consent:</span> unsubscribe from marketing at any time.</>,
                  <><span className="text-bone">Nominate someone:</span> to use these rights for you if you die or become unable to.</>,
                  <><span className="text-bone">Complain:</span> write to us (below). If you’re not satisfied with our answer, you can complain to the Data Protection Board of India.</>,
                ]}
              />
              <p>
                To use any of these rights, email <LegalLink href={`mailto:${complaintsEmail}`}>{complaintsEmail}</LegalLink>.
                We acknowledge complaints within 48 hours and aim to resolve them within one month.
              </p>
            </>
          ),
        },
        {
          id: "children",
          title: "Children",
          body: (
            <p>
              MANGOSTA is meant for adults. If you’re under 18, please don’t create an account or place an order
              yourself: ask a parent or guardian to do it for you.
            </p>
          ),
        },
        {
          id: "changes",
          title: "Changes to this policy",
          body: (
            <p>
              We’ll update this page if the way we handle personal data changes, and change the “Last updated” date. If
              a change is significant, we’ll also tell you by email or on the site.
            </p>
          ),
        },
        {
          id: "contact",
          title: "Contact",
          body: (
            <>
              <p>Questions about this policy or your data:</p>
              <BusinessContact details={business} />
            </>
          ),
        },
      ]}
    />
  );
}
