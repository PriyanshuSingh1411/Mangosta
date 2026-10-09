"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/app/components/AuthProvider";
import { useToast } from "@/app/components/ToastProvider";

type Step = "closed" | "checking" | "blocked" | "intro" | "code";

/**
 * Account page → "Delete account". The customer asks for a code (emailed
 * to the account email) and enters it to delete the account for good.
 * What is deleted / kept is explained before they start; the server rules
 * are in app/lib/accountDeletion.ts.
 */
export default function DeleteAccount({ email }: { email: string }) {
  const { logout } = useAuth();
  const { toast } = useToast();
  const router = useRouter();

  const [step, setStep] = useState<Step>("closed");
  const [reason, setReason] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const open = async () => {
    setStep("checking");
    setError(null);
    try {
      const response = await fetch("/api/account/delete", { cache: "no-store" });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || "Couldn't check your account right now.");
      if (data?.canDelete) {
        setStep("intro");
      } else {
        setReason(String(data?.reason || ""));
        setStep("blocked");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't check your account right now.");
      setStep("closed");
    }
  };

  const sendCode = async () => {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/account/delete/code", { method: "POST" });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        if (response.status === 409) {
          setReason(String(data?.error || ""));
          setStep("blocked");
          return;
        }
        throw new Error(data?.error || "Couldn't send the code right now.");
      }
      setCode("");
      setStep("code");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't send the code right now.");
    } finally {
      setBusy(false);
    }
  };

  const confirm = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/account/delete", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code: code.trim() }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        if (response.status === 409) {
          setReason(String(data?.error || ""));
          setStep("blocked");
          return;
        }
        throw new Error(data?.error || "Couldn't delete your account right now.");
      }
      await logout().catch(() => undefined);
      toast("Your account has been deleted.", "success");
      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't delete your account right now.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="mt-12 border border-line bg-charcoal p-6 sm:p-8" aria-labelledby="delete-account-title">
      <p id="delete-account-title" className="label-technical">
        DELETE ACCOUNT
      </p>

      {step === "closed" || step === "checking" ? (
        <>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-stone">
            Permanently delete your MANGOSTA account and the personal details saved with it.
          </p>
          <button
            type="button"
            onClick={open}
            disabled={step === "checking"}
            className="mt-5 border border-line-strong px-5 py-3 text-xs tracking-[0.16em] text-bone transition-colors hover:border-red-400 hover:text-red-300 disabled:opacity-50"
          >
            {step === "checking" ? "CHECKING…" : "DELETE MY ACCOUNT"}
          </button>
        </>
      ) : null}

      {step === "blocked" && (
        <>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-bone-dim" role="status">
            {reason}
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              href="/orders"
              className="border border-line-strong px-5 py-3 text-xs tracking-[0.16em] text-bone hover:border-bone"
            >
              VIEW ORDERS
            </Link>
            <button
              type="button"
              onClick={() => setStep("closed")}
              className="px-2 py-3 text-xs tracking-[0.16em] text-stone hover:text-bone"
            >
              CLOSE
            </button>
          </div>
        </>
      )}

      {step === "intro" && (
        <>
          <div className="mt-4 max-w-2xl space-y-3 text-sm leading-relaxed text-stone">
            <p>
              <span className="text-bone">Deleted:</span> your login, saved addresses, size profile, bag,
              wishlist, back-in-stock alerts, newsletter subscription and support messages. You&apos;ll be
              signed out on every device.
            </p>
            <p>
              <span className="text-bone">Kept:</span> records of your past orders and returns, which the law
              requires us to keep. They no longer belong to an account (if you sign up again with the same
              email, they&apos;ll show there again). Your reviews stay up as &ldquo;Verified buyer&rdquo;,
              without your name.
            </p>
            <p className="text-bone-dim">This can&apos;t be undone.</p>
          </div>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={sendCode}
              disabled={busy}
              className="bg-bone px-5 py-3 text-xs font-medium tracking-[0.16em] text-void hover:bg-red-300 disabled:opacity-50"
            >
              {busy ? "SENDING…" : "EMAIL ME A CODE"}
            </button>
            <button
              type="button"
              onClick={() => setStep("closed")}
              className="px-2 py-3 text-xs tracking-[0.16em] text-stone hover:text-bone"
            >
              CANCEL
            </button>
          </div>
        </>
      )}

      {step === "code" && (
        <form onSubmit={confirm} className="mt-4 max-w-md">
          <p className="text-sm leading-relaxed text-stone">
            We&apos;ve sent a 6-digit code to <span className="text-bone [overflow-wrap:anywhere]">{email}</span>.
            Enter it to delete your account.
          </p>
          <label htmlFor="delete-account-code" className="label-technical mt-5 block text-stone">
            CODE
          </label>
          <input
            id="delete-account-code"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={code}
            onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
            className="mt-2 w-full border border-line-strong bg-void px-4 py-3 font-mono text-lg tracking-[0.4em] text-bone outline-none focus:border-bone"
          />
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={busy || code.length !== 6}
              className="bg-red-400 px-5 py-3 text-xs font-medium tracking-[0.16em] text-void hover:bg-red-300 disabled:opacity-50"
            >
              {busy ? "DELETING…" : "DELETE MY ACCOUNT"}
            </button>
            <button
              type="button"
              onClick={sendCode}
              disabled={busy}
              className="px-2 py-3 text-xs tracking-[0.16em] text-stone hover:text-bone disabled:opacity-50"
            >
              SEND A NEW CODE
            </button>
            <button
              type="button"
              onClick={() => setStep("closed")}
              className="px-2 py-3 text-xs tracking-[0.16em] text-stone hover:text-bone"
            >
              CANCEL
            </button>
          </div>
        </form>
      )}

      {error && (
        <p className="mt-4 text-sm text-red-300" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
