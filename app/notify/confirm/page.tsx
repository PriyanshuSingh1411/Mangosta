import type { Metadata } from "next";
import Link from "next/link";
import Navigation from "@/app/components/Navigation";
import EmailLinkAction from "@/app/components/EmailLinkAction";
import { isValidStockAlertToken } from "@/app/lib/emailPreferences";

export const metadata: Metadata = {
  title: "Confirm your alert | MANGOSTA",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/** Opened from the "Confirm your back-in-stock alert" email. */
export default async function NotifyConfirmPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string | string[]; e?: string | string[]; t?: string | string[] }>;
}) {
  const params = await searchParams;
  const id = typeof params.id === "string" ? params.id : "";
  const email = typeof params.e === "string" ? params.e.trim().toLowerCase() : "";
  const token = typeof params.t === "string" ? params.t : "";
  const valid = isValidStockAlertToken(id, email, token);

  return (
    <>
      <Navigation />
      <main id="main-content" className="min-h-screen bg-void px-5 pb-24 pt-28 sm:px-8 sm:pt-32 lg:px-12">
        <div className="mx-auto max-w-xl">
          <p className="label-technical mb-4">MANGOSTA / BACK IN STOCK</p>
          <h1 className="type-title text-bone">CONFIRM ALERT</h1>

          <div className="mt-8 border border-line bg-charcoal p-6 sm:p-8">
            {valid ? (
              <>
                <p className="text-sm leading-relaxed text-stone">
                  Email <span className="text-bone [overflow-wrap:anywhere]">{email}</span> once
                  when the size you asked about is back in stock?
                </p>
                <EmailLinkAction
                  endpoint={`/api/stock-alerts/confirm?id=${encodeURIComponent(id)}&e=${encodeURIComponent(email)}&t=${encodeURIComponent(token)}`}
                  buttonLabel="YES, NOTIFY ME"
                  busyLabel="CONFIRMING…"
                  doneTitle="Alert confirmed."
                  doneText="We'll email you once as soon as it's back in stock."
                />
              </>
            ) : (
              <>
                <p className="text-sm leading-relaxed text-stone">
                  This link isn&apos;t valid or is incomplete. You can ask again from the product page.
                </p>
                <Link
                  href="/shop"
                  className="mt-6 inline-block border border-line-strong px-6 py-3 text-xs tracking-[0.16em] text-bone transition-colors hover:border-bone"
                >
                  GO TO THE SHOP
                </Link>
              </>
            )}
          </div>
        </div>
      </main>
    </>
  );
}
