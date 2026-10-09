import type { Metadata } from "next";
import Link from "next/link";
import Navigation from "@/app/components/Navigation";
import EmailLinkAction from "@/app/components/EmailLinkAction";
import { isValidNewsletterConfirmToken } from "@/app/lib/emailPreferences";

export const metadata: Metadata = {
  title: "Confirm your subscription | MANGOSTA",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/** Opened from the "Confirm your MANGOSTA WORLD subscription" email. */
export default async function NewsletterConfirmPage({
  searchParams,
}: {
  searchParams: Promise<{ e?: string | string[]; t?: string | string[] }>;
}) {
  const params = await searchParams;
  const email = typeof params.e === "string" ? params.e.trim().toLowerCase() : "";
  const token = typeof params.t === "string" ? params.t : "";
  const valid = isValidNewsletterConfirmToken(email, token);

  return (
    <>
      <Navigation />
      <main id="main-content" className="min-h-screen bg-void px-5 pb-24 pt-28 sm:px-8 sm:pt-32 lg:px-12">
        <div className="mx-auto max-w-xl">
          <p className="label-technical mb-4">MANGOSTA / EMAILS</p>
          <h1 className="type-title text-bone">CONFIRM</h1>

          <div className="mt-8 border border-line bg-charcoal p-6 sm:p-8">
            {valid ? (
              <>
                <p className="text-sm leading-relaxed text-stone">
                  Start MANGOSTA WORLD emails (new drops, restocks and members-only offers) for{" "}
                  <span className="text-bone [overflow-wrap:anywhere]">{email}</span>?
                </p>
                <EmailLinkAction
                  endpoint={`/api/newsletter/confirm?e=${encodeURIComponent(email)}&t=${encodeURIComponent(token)}`}
                  buttonLabel="YES, SUBSCRIBE"
                  busyLabel="CONFIRMING…"
                  doneTitle="You're in."
                  doneText="Welcome to MANGOSTA WORLD. Every email has an unsubscribe link."
                />
              </>
            ) : (
              <>
                <p className="text-sm leading-relaxed text-stone">
                  This link isn&apos;t valid or is incomplete. You can join from the form at the
                  bottom of any page.
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
