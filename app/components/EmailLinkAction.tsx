"use client";

import { useState } from "react";
import Link from "next/link";

/**
 * The confirm button on pages opened from email links (unsubscribe, join
 * the newsletter again). Nothing changes until the button is pressed, so
 * mail scanners that open links can't trigger it.
 */
export default function EmailLinkAction({
  endpoint,
  buttonLabel,
  busyLabel,
  doneTitle,
  doneText,
}: {
  /** POST URL (already includes the signed e / t parameters). */
  endpoint: string;
  buttonLabel: string;
  busyLabel: string;
  doneTitle: string;
  doneText: string;
}) {
  const [state, setState] = useState<"idle" | "saving" | "done">("idle");
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setState("saving");
    setError(null);
    try {
      const response = await fetch(endpoint, { method: "POST" });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || "Something went wrong. Please try again.");
      setState("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      setState("idle");
    }
  };

  if (state === "done") {
    return (
      <div className="mt-6" aria-live="polite">
        <p className="text-sm font-medium text-bone">{doneTitle}</p>
        <p className="mt-1 text-xs leading-relaxed text-stone">{doneText}</p>
        <Link href="/shop" className="mt-5 inline-block text-xs tracking-[0.16em] text-bone underline underline-offset-4 hover:text-mango">
          BACK TO THE SHOP
        </Link>
      </div>
    );
  }

  return (
    <div className="mt-6">
      <button
        type="button"
        onClick={() => void run()}
        disabled={state === "saving"}
        className="w-full bg-bone px-6 py-3.5 text-xs font-medium tracking-[0.16em] text-void transition-colors hover:bg-mango disabled:opacity-50 sm:w-auto"
      >
        {state === "saving" ? busyLabel : buttonLabel}
      </button>
      {error && (
        <p role="alert" className="mt-3 text-xs text-mango">
          {error}
        </p>
      )}
    </div>
  );
}
