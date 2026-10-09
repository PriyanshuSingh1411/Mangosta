import type { Metadata } from "next";
import Link from "next/link";
import Navigation from "@/app/components/Navigation";
import { isValidUnsubscribeToken } from "@/app/lib/emailPreferences";
import EmailLinkAction from "@/app/components/EmailLinkAction";

export const metadata: Metadata = {
  title: "Unsubscribe | MANGOSTA",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/** Confirm page for the "Unsubscribe" link in marketing emails. */
export default async function UnsubscribePage({
  searchParams,
}: {
  searchParams: Promise<{ e?: string | string[]; t?: string | string[] }>;
}) {
  const params = await searchParams;
  const email = typeof params.e === "string" ? params.e.trim().toLowerCase() : "";
  const token = typeof params.t === "string" ? params.t : "";
  const valid = isValidUnsubscribeToken(email, token);

  return (
    <>
      <Navigation />
      <main id="main-content" className="min-h-screen bg-void px-5 pb-24 pt-28 sm:px-8 sm:pt-32 lg:px-12">
        <div className="mx-auto max-w-xl">
          <p className="label-technical mb-4">MANGOSTA / EMAILS</p>
          <h1 className="type-title text-bone">UNSUBSCRIBE</h1>

          {valid ? (
            <div className="mt-8 border border-line bg-charcoal p-6 sm:p-8">
              <p className="text-sm leading-relaxed text-stone">
                Stop all marketing emails (new drops, offers and bag reminders) to{" "}
                <span className="text-bone [overflow-wrap:anywhere]">{email}</span>?
              </p>
              <p className="mt-2 text-xs leading-relaxed text-stone">
                Order, delivery and sign-in emails will still be sent.
              </p>
              <EmailLinkAction
                endpoint={`/api/unsubscribe?e=${encodeURIComponent(email)}&t=${encodeURIComponent(token)}`}
                buttonLabel="UNSUBSCRIBE"
                busyLabel="UNSUBSCRIBING…"
                doneTitle="You're unsubscribed."
                doneText="You won't get marketing emails from MANGOSTA any more. Changed your mind? Tick “New drops & editorial updates” on your account page, or join again from the form at the bottom of any page."
              />
            </div>
          ) : (
            <div className="mt-8 border border-line bg-charcoal p-6 sm:p-8">
              <p className="text-sm leading-relaxed text-stone">
                This unsubscribe link isn&apos;t valid or is incomplete. You can turn off marketing
                emails from your account page instead.
              </p>
              <Link
                href="/account"
                className="mt-6 inline-block border border-line-strong px-6 py-3 text-xs tracking-[0.16em] text-bone transition-colors hover:border-bone"
              >
                GO TO ACCOUNT
              </Link>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
