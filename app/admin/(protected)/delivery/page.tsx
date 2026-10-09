"use client";

import { useState } from "react";
import { checkPincode, formatDeliveryRange } from "@/app/data/storeTypes";
import type { DeliveryConfig, PincodeRule } from "@/app/data/storeTypes";
import { adminButtonClass, adminInputClass, useStoreConfig } from "../useStoreConfig";

function newRule(): PincodeRule {
  return {
    id: `rule-${Date.now()}`,
    prefix: "",
    label: "",
    minDays: 2,
    maxDays: 4,
    cod: true,
    serviceable: true,
  };
}

export default function AdminDeliveryPage() {
  const { value, update, save, loading, saving, error, saved } =
    useStoreConfig<DeliveryConfig>("delivery");
  const [testCode, setTestCode] = useState("");

  if (loading || !value) {
    return (
      <div>
        <p className="label-technical mb-2">SHIPPING</p>
        <h1 className="type-heading text-bone">Delivery &amp; PIN codes</h1>
        <p className="mt-8 text-sm text-stone">{error ?? "Loading…"}</p>
      </div>
    );
  }

  const setRule = (index: number, updates: Partial<PincodeRule>) =>
    update({
      rules: value.rules.map((rule, i) => (i === index ? { ...rule, ...updates } : rule)),
    });

  const test = /^[1-9]\d{5}$/.test(testCode) ? checkPincode(value, testCode) : null;
  const numberInput = "w-16 border border-line-strong bg-transparent px-2 py-1.5 text-center font-mono text-sm text-bone focus:border-bone focus:outline-none";

  return (
    <div className="max-w-4xl">
      <p className="label-technical mb-2">SHIPPING</p>
      <h1 className="mb-3 type-heading text-bone">Delivery &amp; PIN codes</h1>
      <p className="mb-8 max-w-2xl text-sm leading-relaxed text-stone">
        Customers check their PIN code on product pages to see the delivery date and whether
        cash on delivery is available. Checkout uses the same rules: PIN codes you don&apos;t
        deliver to can&apos;t order, and COD is hidden where it isn&apos;t allowed.
      </p>

      <section className="mb-8 flex flex-col gap-4 border border-line-strong bg-charcoal/30 p-5">
        <label className="flex items-center gap-2 text-sm text-bone-dim">
          <input
            type="checkbox"
            checked={value.enabled}
            onChange={(e) => update({ enabled: e.target.checked })}
            className="h-4 w-4 accent-[color:var(--color-mango)]"
          />
          Show the PIN code check and apply these rules at checkout
        </label>

        <p className="label-technical mt-2">ALL OTHER PIN CODES</p>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3 text-sm text-bone-dim">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={value.deliverEverywhere}
              onChange={(e) => update({ deliverEverywhere: e.target.checked })}
              className="h-4 w-4 accent-[color:var(--color-mango)]"
            />
            We deliver there
          </label>
          <label className="flex items-center gap-2">
            Delivery in
            <input
              type="number"
              min={0}
              value={value.defaultMinDays}
              onChange={(e) => update({ defaultMinDays: Number(e.target.value) })}
              className={numberInput}
              aria-label="Minimum days"
            />
            to
            <input
              type="number"
              min={0}
              value={value.defaultMaxDays}
              onChange={(e) => update({ defaultMaxDays: Number(e.target.value) })}
              className={numberInput}
              aria-label="Maximum days"
            />
            days
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={value.defaultCod}
              onChange={(e) => update({ defaultCod: e.target.checked })}
              className="h-4 w-4 accent-[color:var(--color-mango)]"
            />
            Cash on delivery
          </label>
        </div>
      </section>

      <section className="mb-8">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="label-technical">AREA RULES</p>
            <p className="mt-1 text-xs text-stone">
              Match PIN codes by their first digits — e.g. <span className="font-mono">400</span> = Mumbai,{" "}
              <span className="font-mono">110</span> = Delhi, or a full 6-digit code. The longest match wins.
            </p>
          </div>
          <button
            type="button"
            onClick={() => update({ rules: [...value.rules, newRule()] })}
            className="border border-line-strong px-4 py-2.5 text-xs tracking-[0.12em] text-bone hover:border-bone"
          >
            + ADD RULE
          </button>
        </div>

        {value.rules.length === 0 ? (
          <p className="border border-line px-5 py-8 text-center text-sm text-stone">
            No area rules — every PIN code uses the settings above.
          </p>
        ) : (
          <div className="overflow-x-auto border border-line-strong">
            <table className="w-full min-w-[640px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-line-strong text-left text-xs text-stone">
                  <th className="px-3 py-2 font-normal">PIN starts with</th>
                  <th className="px-3 py-2 font-normal">Area name</th>
                  <th className="px-3 py-2 font-normal">Days</th>
                  <th className="px-3 py-2 font-normal">Deliver</th>
                  <th className="px-3 py-2 font-normal">COD</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {value.rules.map((rule, index) => (
                  <tr key={rule.id} className="border-b border-line last:border-b-0">
                    <td className="px-3 py-2">
                      <input
                        value={rule.prefix}
                        inputMode="numeric"
                        onChange={(e) => setRule(index, { prefix: e.target.value.replace(/\D/g, "").slice(0, 6) })}
                        placeholder="400"
                        aria-label="PIN code prefix"
                        className="w-24 border border-line-strong bg-transparent px-2 py-1.5 font-mono text-sm text-bone placeholder:text-stone-dark focus:border-bone focus:outline-none"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        value={rule.label}
                        onChange={(e) => setRule(index, { label: e.target.value })}
                        placeholder="Mumbai"
                        aria-label="Area name"
                        className="w-36 border border-line-strong bg-transparent px-2 py-1.5 text-sm text-bone placeholder:text-stone-dark focus:border-bone focus:outline-none"
                      />
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap text-stone">
                      <input
                        type="number"
                        min={0}
                        value={rule.minDays}
                        onChange={(e) => setRule(index, { minDays: Number(e.target.value) })}
                        aria-label="Minimum days"
                        className={numberInput}
                      />{" "}
                      –{" "}
                      <input
                        type="number"
                        min={0}
                        value={rule.maxDays}
                        onChange={(e) => setRule(index, { maxDays: Number(e.target.value) })}
                        aria-label="Maximum days"
                        className={numberInput}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={rule.serviceable}
                        onChange={(e) => setRule(index, { serviceable: e.target.checked })}
                        aria-label="We deliver here"
                        className="h-4 w-4 accent-[color:var(--color-mango)]"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={rule.cod}
                        disabled={!rule.serviceable}
                        onChange={(e) => setRule(index, { cod: e.target.checked })}
                        aria-label="Cash on delivery"
                        className="h-4 w-4 accent-[color:var(--color-mango)] disabled:opacity-30"
                      />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button
                        type="button"
                        onClick={() => update({ rules: value.rules.filter((_, i) => i !== index) })}
                        className="px-2 text-xs text-stone hover:text-mango"
                        aria-label={`Remove rule ${rule.prefix}`}
                      >
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="mb-8 border border-line p-5">
        <p className="label-technical mb-3">TEST A PIN CODE</p>
        <input
          value={testCode}
          onChange={(e) => setTestCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          inputMode="numeric"
          placeholder="400001"
          aria-label="PIN code to test"
          className={`${adminInputClass} max-w-[200px] font-mono`}
        />
        {test && (
          <p className="mt-3 text-sm text-bone-dim">
            {!test.serviceable
              ? "Not deliverable — customers can't order."
              : `Delivery ${formatDeliveryRange(test.minDays, test.maxDays)} (${test.minDays}–${test.maxDays} days)${
                  test.area ? ` · ${test.area}` : ""
                } · COD ${test.cod ? "available" : "not available"}`}
          </p>
        )}
        <p className="mt-2 text-xs text-stone">Uses the values on this page, before saving.</p>
      </section>

      {error && <p role="alert" className="mb-4 text-sm text-mango">{error}</p>}

      <div className="flex items-center gap-4">
        <button type="button" onClick={() => void save()} disabled={saving} className={adminButtonClass}>
          {saving ? "SAVING…" : "SAVE DELIVERY SETTINGS"}
        </button>
        {saved && <span className="text-xs text-mango">Saved.</span>}
      </div>
    </div>
  );
}
