"use client";

import { useState } from "react";
import { useAuth } from "@/app/components/AuthProvider";

/** "Notify me when back in stock" for one sold-out size / colour. */
export default function NotifyMe({
  productId,
  color,
  size,
  className = "",
}: {
  productId: string;
  color: string;
  size: string;
  className?: string;
}) {
  const { user } = useAuth();
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "saving" | "done">("idle");
  const [message, setMessage] = useState<string | null>(null);

  const value = email || user?.email || "";

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setState("saving");
    setMessage(null);

    try {
      const response = await fetch("/api/stock-alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, color, size, email: value }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || "Couldn't save your request.");
      setState("done");
      setMessage(
        data?.alreadyWaiting
          ? "You're already on the list — we'll email you."
          : "Done — we'll email you when it's back."
      );
    } catch (error) {
      setState("idle");
      setMessage(error instanceof Error ? error.message : "Couldn't save your request.");
    }
  };

  const label = [color, size].filter(Boolean).join(" / ");

  return (
    <div className={`border border-line-strong p-4 ${className}`}>
      <p className="text-xs text-bone">
        <span className="font-medium">{label}</span> is sold out.
      </p>
      {state === "done" ? (
        <p className="mt-2 text-xs text-mango" aria-live="polite">{message}</p>
      ) : (
        <form onSubmit={submit} className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input
            type="email"
            required
            value={value}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="Your email"
            aria-label="Email for back-in-stock alert"
            className="min-w-0 flex-1 border border-line-strong bg-transparent px-3 py-2.5 text-sm text-bone placeholder:text-stone-dark focus:border-bone focus:outline-none"
          />
          <button
            type="submit"
            disabled={state === "saving"}
            className="shrink-0 bg-bone px-4 py-2.5 text-[10px] font-medium uppercase tracking-[0.18em] text-void transition-colors hover:bg-mango disabled:opacity-50"
          >
            {state === "saving" ? "Saving…" : "Notify me"}
          </button>
          {message && <p className="text-xs text-mango sm:basis-full" aria-live="polite">{message}</p>}
        </form>
      )}
    </div>
  );
}
