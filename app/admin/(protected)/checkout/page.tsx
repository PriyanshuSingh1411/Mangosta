"use client";

import { useEffect, useMemo, useState } from "react";
import { shippingSettingsWarnings } from "@/app/data/checkoutWarnings";
import { getProductSalePrice, type Product } from "@/app/data/productTypes";

type ShippingRule = {
  id: string;
  enabled: boolean;
  minOrderValue: number;
  shippingCost: number;
};

type CheckoutReward = {
  id: string;
  enabled: boolean;
  threshold: number;
  discountPercent: number;
  couponCode: string;
};

type CheckoutSettings = {
  enabled: boolean;
  defaultShipping: number;
  freeShippingEnabled: boolean;
  freeShippingThreshold: number;
  rules: ShippingRule[];
  progressRewards: CheckoutReward[];
};

const DEFAULT_SETTINGS: CheckoutSettings = {
  enabled: true,
  defaultShipping: 12,
  // Off until a real threshold is set (a tiny threshold makes everything free).
  freeShippingEnabled: false,
  freeShippingThreshold: 10,
  rules: [],
  progressRewards: [
    { id: "reward-1", enabled: true, threshold: 1000, discountPercent: 10, couponCode: "" },
    { id: "reward-2", enabled: true, threshold: 1500, discountPercent: 15, couponCode: "" },
    { id: "reward-3", enabled: true, threshold: 2000, discountPercent: 20, couponCode: "" },
  ],
};

const inputClass =
  "w-full border border-line-strong bg-transparent px-3.5 py-2.5 text-sm text-bone placeholder:text-stone-dark focus:border-bone focus:outline-none";

export default function AdminCheckoutPage() {
  const [settings, setSettings] = useState<CheckoutSettings>(DEFAULT_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Lowest product price, to spot a free-shipping threshold every order reaches.
  const [cheapestPrice, setCheapestPrice] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/products", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : []))
      .then((products: Product[]) => {
        if (cancelled || !Array.isArray(products) || products.length === 0) return;
        const prices = products
          .map((product) => getProductSalePrice(product))
          .filter((price) => price > 0);
        if (prices.length > 0) setCheapestPrice(Math.min(...prices));
      })
      .catch(() => undefined); // warnings just skip this check
    return () => {
      cancelled = true;
    };
  }, []);

  // Settings that can never take effect, shown live while editing.
  const warnings = useMemo(
    () => shippingSettingsWarnings(settings, cheapestPrice),
    [settings, cheapestPrice]
  );

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const response = await fetch("/api/admin/checkout", {
          cache: "no-store",
        });
        const data = await response.json().catch(() => null);

        if (!response.ok) {
          throw new Error(data?.error || "Failed to load checkout settings.");
        }

        if (!cancelled) {
          setSettings({
            ...DEFAULT_SETTINGS,
            ...data,
            rules: Array.isArray(data?.rules) ? data.rules : [],
            progressRewards: Array.isArray(data?.progressRewards) ? data.progressRewards : DEFAULT_SETTINGS.progressRewards,
          });
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Failed to load checkout settings."
          );
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const update = <K extends keyof CheckoutSettings>(
    key: K,
    value: CheckoutSettings[K]
  ) => {
    setSettings((current) => ({ ...current, [key]: value }));
    setSaved(false);
    setError(null);
  };

  const updateRule = (index: number, updates: Partial<ShippingRule>) => {
    setSettings((current) => ({
      ...current,
      rules: current.rules.map((rule, ruleIndex) =>
        ruleIndex === index ? { ...rule, ...updates } : rule
      ),
    }));
    setSaved(false);
    setError(null);
  };

  const addRule = () => {
    setSettings((current) => ({
      ...current,
      rules: [
        ...current.rules,
        {
          id: `shipping-rule-${Date.now()}`,
          enabled: true,
          minOrderValue: 0,
          shippingCost: current.defaultShipping,
        },
      ],
    }));
    setSaved(false);
    setError(null);
  };

  const removeRule = (index: number) => {
    setSettings((current) => ({
      ...current,
      rules: current.rules.filter((_, ruleIndex) => ruleIndex !== index),
    }));
    setSaved(false);
    setError(null);
  };

  const updateReward = (index: number, updates: Partial<CheckoutReward>) => {
    setSettings((current) => ({
      ...current,
      progressRewards: current.progressRewards.map((reward, rewardIndex) =>
        rewardIndex === index ? { ...reward, ...updates } : reward
      ),
    }));
    setSaved(false);
    setError(null);
  };

  const generateRewardCode = (index: number) => {
    const reward = settings.progressRewards[index];
    if (!reward) return;
    const suffix = typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().replace(/-/g, "").slice(0, 6).toUpperCase()
      : Math.random().toString(36).slice(2, 8).toUpperCase();
    updateReward(index, { couponCode: `MANGO-${Math.round(reward.threshold)}-${suffix}` });
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaved(false);
    setError(null);

    try {
      const response = await fetch("/api/admin/checkout", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(data?.error || "Failed to save checkout settings.");
      }

      setSettings({
        ...DEFAULT_SETTINGS,
        ...data,
        rules: Array.isArray(data?.rules) ? data.rules : [],
        progressRewards: Array.isArray(data?.progressRewards) ? data.progressRewards : DEFAULT_SETTINGS.progressRewards,
      });
      setSaved(true);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to save checkout settings."
      );
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div>
        <p className="label-technical mb-2">CHECKOUT</p>
        <h1 className="type-heading text-bone">
          Checkout
        </h1>
        <p className="mt-8 text-sm text-stone">Loading…</p>
      </div>
    );
  }

  return (
    <div>
      <p className="label-technical mb-2">CHECKOUT</p>
      <h1 className="mb-3 type-heading text-bone">
        Checkout
      </h1>
      <p className="mb-10 max-w-2xl text-sm leading-relaxed text-stone">
        Control shipping charges and free-shipping thresholds used on the
        storefront checkout.
      </p>

      <div className="flex max-w-3xl flex-col gap-10">
        {warnings.length > 0 && (
          <div role="status" className="border border-mango/40 bg-mango/5 px-5 py-4">
            <p className="label-technical mb-2 text-mango">CHECK THESE SETTINGS</p>
            <ul className="flex list-disc flex-col gap-1.5 pl-4 text-xs leading-relaxed text-bone-dim">
              {warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          </div>
        )}

        <section className="border border-line-strong p-6 sm:p-8">
          <div className="mb-6">
            <p className="label-technical mb-2">SHIPPING</p>
            <h2 className="font-display text-lg tracking-tight text-bone sm:text-xl">
              General shipping settings
            </h2>
          </div>

          <div className="flex flex-col gap-5">
            <label className="flex items-center gap-3 text-sm text-bone-dim">
              <input
                type="checkbox"
                checked={settings.enabled}
                onChange={(e) => update("enabled", e.target.checked)}
                className="h-4 w-4 accent-[color:var(--color-mango)]"
              />
              Enable shipping charges
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-xs text-stone">Default shipping charge</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={settings.defaultShipping}
                onChange={(e) =>
                  update("defaultShipping", Math.max(0, Number(e.target.value) || 0))
                }
                className={inputClass}
              />
              <span className="text-xs text-stone-dark">
                Used when no shipping rule matches.
              </span>
            </label>
          </div>
        </section>

        <section className="border border-line-strong p-6 sm:p-8">
          <div className="mb-6">
            <p className="label-technical mb-2">FREE SHIPPING</p>
            <h2 className="font-display text-lg tracking-tight text-bone sm:text-xl">
              Free shipping threshold
            </h2>
          </div>

          <div className="flex flex-col gap-5">
            <label className="flex items-center gap-3 text-sm text-bone-dim">
              <input
                type="checkbox"
                checked={settings.freeShippingEnabled}
                onChange={(e) =>
                  update("freeShippingEnabled", e.target.checked)
                }
                className="h-4 w-4 accent-[color:var(--color-mango)]"
              />
              Enable free shipping
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-xs text-stone">
                Free shipping from order value
              </span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={settings.freeShippingThreshold}
                onChange={(e) =>
                  update(
                    "freeShippingThreshold",
                    Math.max(0, Number(e.target.value) || 0)
                  )
                }
                className={inputClass}
              />
              <span className="text-xs text-stone-dark">
                Example: enter 1999 and carts of ₹1,999 or more ship free.
              </span>
            </label>
          </div>
        </section>

        <section className="border border-line-strong p-6 sm:p-8">
          <div className="mb-6 flex items-start justify-between gap-4">
            <div>
              <p className="label-technical mb-2">SHIPPING RULES</p>
              <h2 className="font-display text-lg tracking-tight text-bone sm:text-xl">
                Order-based shipping
              </h2>
              <p className="mt-2 text-xs leading-relaxed text-stone">
                Rules are checked from the highest minimum order value downward.
                Free shipping, when enabled, takes priority.
              </p>
            </div>

            <button
              type="button"
              onClick={addRule}
              className="shrink-0 border border-line-strong px-4 py-2 text-xs tracking-[0.12em] text-bone transition-colors hover:border-mango hover:text-mango"
            >
              + ADD RULE
            </button>
          </div>

          {settings.rules.length === 0 ? (
            <div className="border border-dashed border-line-strong px-5 py-10 text-center">
              <p className="text-sm text-stone">No custom shipping rules.</p>
              <p className="mt-1 text-xs text-stone-dark">
                The default shipping charge will be used below the free-shipping threshold.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {settings.rules.map((rule, index) => (
                <div
                  key={rule.id}
                  className="border border-line bg-charcoal p-5"
                >
                  <div className="mb-5 flex items-center justify-between gap-4">
                    <span className="label-technical">RULE {String(index + 1).padStart(2, "0")}</span>
                    <button
                      type="button"
                      onClick={() => removeRule(index)}
                      className="text-xs text-stone transition-colors hover:text-mango"
                    >
                      REMOVE
                    </button>
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <label className="flex flex-col gap-1.5">
                      <span className="text-xs text-stone">
                        Minimum order value
                      </span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={rule.minOrderValue}
                        onChange={(e) =>
                          updateRule(index, {
                            minOrderValue: Math.max(
                              0,
                              Number(e.target.value) || 0
                            ),
                          })
                        }
                        className={inputClass}
                      />
                    </label>

                    <label className="flex flex-col gap-1.5">
                      <span className="text-xs text-stone">
                        Shipping charge
                      </span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={rule.shippingCost}
                        onChange={(e) =>
                          updateRule(index, {
                            shippingCost: Math.max(
                              0,
                              Number(e.target.value) || 0
                            ),
                          })
                        }
                        className={inputClass}
                      />
                    </label>
                  </div>

                  <label className="mt-4 flex items-center gap-3 text-sm text-bone-dim">
                    <input
                      type="checkbox"
                      checked={rule.enabled}
                      onChange={(e) =>
                        updateRule(index, { enabled: e.target.checked })
                      }
                      className="h-4 w-4 accent-[color:var(--color-mango)]"
                    />
                    Rule enabled
                  </label>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="relative overflow-hidden border border-mango/30 bg-charcoal p-6 sm:p-8">
          <div className="pointer-events-none absolute right-0 top-0 h-40 w-40 rounded-full bg-mango/10 blur-3xl" />
          <div className="relative">
            <div className="mb-7">
              <p className="label-technical mb-2 text-mango">CHECKOUT REWARDS</p>
              <h2 className="font-display text-lg tracking-tight text-bone sm:text-xl">Unlock Progress Bar</h2>
              <p className="mt-2 max-w-2xl text-xs leading-relaxed text-stone">
                Create up to three cart-value milestones. When a customer reaches a milestone, its percentage coupon is unlocked and automatically applied at checkout. These rewards are managed here and do not use the regular Coupons section.
              </p>
            </div>

            <div className="flex flex-col gap-4">
              {settings.progressRewards.map((reward, index) => (
                <div key={reward.id} className="border border-line bg-void p-5">
                  <div className="mb-5 flex items-center justify-between gap-4">
                    <div>
                      <p className="label-technical text-mango">LEVEL {String(index + 1).padStart(2, "0")}</p>
                      <p className="mt-1 text-xs text-stone">Next checkout milestone</p>
                    </div>
                    <label className="flex items-center gap-2 text-xs text-stone">
                      <input type="checkbox" checked={reward.enabled} onChange={(e) => updateReward(index, { enabled: e.target.checked })} className="h-4 w-4 accent-[color:var(--color-mango)]" />
                      Enabled
                    </label>
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <label className="flex flex-col gap-1.5">
                      <span className="text-xs text-stone">Cart value (₹)</span>
                      <input type="number" min="0" step="50" value={reward.threshold} onChange={(e) => updateReward(index, { threshold: Math.max(0, Number(e.target.value) || 0) })} className={inputClass} />
                    </label>
                    <label className="flex flex-col gap-1.5">
                      <span className="text-xs text-stone">Discount (%)</span>
                      <input type="number" min="0" max="100" step="1" value={reward.discountPercent} onChange={(e) => updateReward(index, { discountPercent: Math.min(100, Math.max(0, Number(e.target.value) || 0)) })} className={inputClass} />
                    </label>
                  </div>

                  <div className="mt-4">
                    <span className="text-xs text-stone">Auto-applied reward coupon</span>
                    <div className="mt-1.5 flex flex-col gap-2 sm:flex-row">
                      <input value={reward.couponCode} onChange={(e) => updateReward(index, { couponCode: e.target.value.toUpperCase().replace(/\s+/g, "") })} placeholder="GENERATE A CODE" className={`${inputClass} font-mono tracking-[0.08em]`} />
                      <button type="button" onClick={() => generateRewardCode(index)} className="shrink-0 border border-mango/50 px-4 py-2.5 text-xs tracking-[0.12em] text-mango transition-colors hover:bg-mango hover:text-void">GENERATE CODE</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 border border-line bg-void/60 p-4">
              <p className="label-technical mb-2">STOREFRONT BEHAVIOUR</p>
              <p className="text-sm text-bone-dim">
                Example: at ₹1,000 the first reward unlocks. At ₹1,200 the customer sees how much is left for the next level. At ₹1,500 the next reward replaces the previous reward and is applied automatically.
              </p>
            </div>
          </div>
        </section>

        <section className="border border-line bg-charcoal p-6 sm:p-8">
          <p className="label-technical mb-4">EXAMPLE</p>
          <div className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-3">
            <div>
              <p className="text-stone">Cart ₹5</p>
              <p className="mt-1 text-bone">Standard shipping</p>
            </div>
            <div>
              <p className="text-stone">Cart ₹10+</p>
              <p className="mt-1 text-mango">FREE shipping</p>
            </div>
            <div>
              <p className="text-stone">Cart ₹100+</p>
              <p className="mt-1 text-bone">Still FREE</p>
            </div>
          </div>
        </section>

        {error && (
          <p role="alert" className="text-sm text-mango">
            {error}
          </p>
        )}

        {saved && (
          <p className="text-sm text-mango">Checkout settings saved.</p>
        )}

        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving}
          className="bg-bone py-4 text-center text-xs font-medium tracking-[0.2em] text-void transition-colors hover:bg-mango disabled:opacity-50"
        >
          {isSaving ? "SAVING…" : "SAVE CHECKOUT SETTINGS"}
        </button>
      </div>
    </div>
  );
}
