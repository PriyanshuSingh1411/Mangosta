"use client";

import { useEffect, useState } from "react";
import { formatDeliveryRange } from "@/app/data/storeTypes";
import type { PincodeCheckResult } from "@/app/data/storeTypes";

const STORAGE_KEY = "mangosta-pincode";

type CheckResponse = PincodeCheckResult & { enabled: boolean };

/** Product-page delivery check: estimated dates + cash on delivery. */
export default function PincodeCheck({ className = "" }: { className?: string }) {
  const [pincode, setPincode] = useState("");
  const [result, setResult] = useState<CheckResponse | null>(null);
  const [enabled, setEnabled] = useState(true);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const check = async (code: string) => {
    if (!/^[1-9]\d{5}$/.test(code)) {
      setError("Enter a valid 6-digit PIN code.");
      setResult(null);
      return;
    }

    setChecking(true);
    setError(null);

    try {
      const response = await fetch(`/api/delivery/check?pincode=${code}`, { cache: "no-store" });
      const data: CheckResponse = await response.json();
      setEnabled(data.enabled);
      setResult(data);
      try {
        localStorage.setItem(STORAGE_KEY, code);
      } catch {
        // storage unavailable — fine
      }
    } catch {
      setError("Couldn't check right now. Please try again.");
    } finally {
      setChecking(false);
    }
  };

  // Re-use the last PIN code this visitor checked (and learn whether the
  // check is switched on in Admin → Delivery).
  useEffect(() => {
    let saved = "";
    try {
      saved = localStorage.getItem(STORAGE_KEY) ?? "";
    } catch {
      saved = "";
    }
    const code = /^[1-9]\d{5}$/.test(saved) ? saved : "";

    fetch(`/api/delivery/check?pincode=${code}`, { cache: "no-store" })
      .then((response) => response.json())
      .then((data: CheckResponse) => {
        setEnabled(data.enabled);
        if (code) {
          setPincode(code);
          setResult(data);
        }
      })
      .catch(() => undefined);
  }, []);

  if (!enabled) return null;

  return (
    <div className={className}>
      <p className="label-technical mb-3">DELIVERY</p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void check(pincode);
        }}
        className="flex max-w-sm border border-line-strong"
      >
        <input
          value={pincode}
          onChange={(event) => setPincode(event.target.value.replace(/\D/g, "").slice(0, 6))}
          inputMode="numeric"
          autoComplete="postal-code"
          placeholder="Enter PIN code"
          aria-label="PIN code"
          className="min-w-0 flex-1 bg-transparent px-3.5 py-3 text-sm text-bone placeholder:text-stone-dark focus:outline-none"
        />
        <button
          type="submit"
          disabled={checking}
          className="shrink-0 border-l border-line-strong px-4 text-[10px] font-medium uppercase tracking-[0.18em] text-bone transition-colors hover:bg-bone hover:text-void disabled:opacity-50"
        >
          {checking ? "…" : "Check"}
        </button>
      </form>

      <div aria-live="polite" className="mt-3 text-xs leading-relaxed">
        {error && <p className="text-mango">{error}</p>}
        {!error && result && result.valid && result.serviceable && (
          <>
            <p className="text-bone">
              Delivery by <span className="font-medium">{formatDeliveryRange(result.minDays, result.maxDays)}</span>
              {result.area ? <span className="text-stone"> · {result.area}</span> : null}
            </p>
            <p className={result.cod ? "text-stone" : "text-mango"}>
              {result.cod ? "Cash on delivery available" : "Cash on delivery not available — pay online"}
            </p>
          </>
        )}
        {!error && result && result.valid && !result.serviceable && (
          <p className="text-mango">Sorry, we don&apos;t deliver to {pincode} yet.</p>
        )}
      </div>
    </div>
  );
}
