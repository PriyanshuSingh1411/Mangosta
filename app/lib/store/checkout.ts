import "server-only";

import { CHECKOUT_SETTINGS_PATH, getDb, isMigrated, markMigrated, omitMongoId, readJson } from "./core";

// Checkout settings: shipping charges, free shipping and cart-value rewards.

type CheckoutSettingsDocument = CheckoutSettings & {
  _id: "default";
};

// ============================================================
// CHECKOUT / SHIPPING SETTINGS
// ============================================================

export interface ShippingRule {
  id: string;
  enabled: boolean;
  minOrderValue: number;
  shippingCost: number;
}

export interface CheckoutReward {
  id: string;
  enabled: boolean;
  threshold: number;
  discountPercent: number;
  couponCode: string;
}

export interface CheckoutSettings {
  enabled: boolean;
  defaultShipping: number;
  freeShippingEnabled: boolean;
  freeShippingThreshold: number;
  rules: ShippingRule[];
  progressRewards: CheckoutReward[];
}

export const DEFAULT_CHECKOUT_REWARDS: CheckoutReward[] = [
  { id: "reward-1", enabled: true, threshold: 1000, discountPercent: 10, couponCode: "" },
  { id: "reward-2", enabled: true, threshold: 1500, discountPercent: 15, couponCode: "" },
  { id: "reward-3", enabled: true, threshold: 2000, discountPercent: 20, couponCode: "" },
];

export const DEFAULT_CHECKOUT_SETTINGS: CheckoutSettings = {
  enabled: true,
  defaultShipping: 12,
  // Off until the admin sets a real threshold (a tiny one makes every
  // order ship free).
  freeShippingEnabled: false,
  freeShippingThreshold: 10,
  rules: [],
  progressRewards: DEFAULT_CHECKOUT_REWARDS,
};

function normalizeCheckoutSettings(
  saved:
    Partial<CheckoutSettings> | null | undefined
): CheckoutSettings {
  const source = saved ?? {};
  const rawRules = Array.isArray(source.rules)
    ? source.rules
    : [];

  const rules: ShippingRule[] = rawRules
    .map((rule, index) => ({
      id:
        typeof rule.id === "string" &&
        rule.id.trim()
          ? rule.id
          : `shipping-rule-${index + 1}`,
      enabled:
        typeof rule.enabled === "boolean"
          ? rule.enabled
          : true,
      minOrderValue:
        typeof rule.minOrderValue === "number" &&
        Number.isFinite(rule.minOrderValue) &&
        rule.minOrderValue >= 0
          ? rule.minOrderValue
          : 0,
      shippingCost:
        typeof rule.shippingCost === "number" &&
        Number.isFinite(rule.shippingCost) &&
        rule.shippingCost >= 0
          ? rule.shippingCost
          : 0,
    }))
    .sort(
      (a, b) =>
        b.minOrderValue - a.minOrderValue
    );

  const rawRewards: CheckoutReward[] = Array.isArray(
    (source as Partial<CheckoutSettings>).progressRewards
  )
    ? ((source as Partial<CheckoutSettings>).progressRewards ?? [])
    : DEFAULT_CHECKOUT_REWARDS;

  const progressRewards: CheckoutReward[] = rawRewards
    .filter((reward): reward is CheckoutReward => Boolean(reward && typeof reward === "object"))
    .slice(0, 3)
    .map((reward, index) => ({
      id: typeof reward.id === "string" && reward.id.trim() ? reward.id.trim() : `reward-${index + 1}`,
      enabled: typeof reward.enabled === "boolean" ? reward.enabled : true,
      threshold: typeof reward.threshold === "number" && Number.isFinite(reward.threshold) && reward.threshold >= 0 ? reward.threshold : DEFAULT_CHECKOUT_REWARDS[index]?.threshold ?? 0,
      discountPercent: typeof reward.discountPercent === "number" && Number.isFinite(reward.discountPercent) ? Math.min(100, Math.max(0, reward.discountPercent)) : DEFAULT_CHECKOUT_REWARDS[index]?.discountPercent ?? 0,
      couponCode: typeof reward.couponCode === "string" ? reward.couponCode.trim().toUpperCase().replace(/\s+/g, "") : "",
    }))
    .sort((a, b) => a.threshold - b.threshold);

  return {
    enabled:
      typeof source.enabled === "boolean"
        ? source.enabled
        : DEFAULT_CHECKOUT_SETTINGS.enabled,
    defaultShipping:
      typeof source.defaultShipping === "number" &&
      Number.isFinite(source.defaultShipping) &&
      source.defaultShipping >= 0
        ? source.defaultShipping
        : DEFAULT_CHECKOUT_SETTINGS.defaultShipping,
    freeShippingEnabled:
      typeof source.freeShippingEnabled ===
      "boolean"
        ? source.freeShippingEnabled
        : DEFAULT_CHECKOUT_SETTINGS.freeShippingEnabled,
    freeShippingThreshold:
      typeof source.freeShippingThreshold ===
        "number" &&
      Number.isFinite(
        source.freeShippingThreshold
      ) &&
      source.freeShippingThreshold >= 0
        ? source.freeShippingThreshold
        : DEFAULT_CHECKOUT_SETTINGS.freeShippingThreshold,
    rules,
    progressRewards: progressRewards.length > 0 ? progressRewards : DEFAULT_CHECKOUT_REWARDS,
  };
}

async function migrateCheckoutFromJson(): Promise<void> {
  const migrationId = "checkout-json-to-mongodb";
  if (await isMigrated(migrationId)) {
    return;
  }

  const db = await getDb();
  const collection =
    db.collection<CheckoutSettingsDocument>(
      "checkoutSettings"
    );

  const existing = await collection.findOne({
    _id: "default",
  });

  if (!existing) {
    const legacy = await readJson<
      Partial<CheckoutSettings>
    >(CHECKOUT_SETTINGS_PATH, {});

    const normalized =
      normalizeCheckoutSettings(legacy);

    await collection.replaceOne(
      { _id: "default" },
      {
        ...normalized,
      },
      { upsert: true }
    );
  }

  await markMigrated(migrationId);
}

export async function getCheckoutSettings(): Promise<CheckoutSettings> {
  await migrateCheckoutFromJson();

  const db = await getDb();
  const collection =
    db.collection<CheckoutSettingsDocument>(
      "checkoutSettings"
    );

  const saved = await collection.findOne({
    _id: "default",
  });

  return normalizeCheckoutSettings(
    saved ? omitMongoId(saved) : null
  );
}

export async function saveCheckoutSettings(
  settings: CheckoutSettings
): Promise<void> {
  const db = await getDb();
  const collection =
    db.collection<CheckoutSettingsDocument>(
      "checkoutSettings"
    );

  const normalized =
    normalizeCheckoutSettings(settings);

  await collection.replaceOne(
    { _id: "default" },
    {
      ...normalized,
    },
    { upsert: true }
  );
}

export function calculateShipping(
  subtotal: number,
  settings: CheckoutSettings
): number {
  const safeSubtotal = Math.max(
    0,
    Number(subtotal) || 0
  );

  if (!settings.enabled) {
    return 0;
  }

  if (
    settings.freeShippingEnabled &&
    safeSubtotal >=
      settings.freeShippingThreshold
  ) {
    return 0;
  }

  const matchingRule = settings.rules
    .filter((rule) => rule.enabled)
    .sort(
      (a, b) =>
        b.minOrderValue - a.minOrderValue
    )
    .find(
      (rule) =>
        safeSubtotal >= rule.minOrderValue
    );

  return matchingRule
    ? Math.max(0, matchingRule.shippingCost)
    : Math.max(0, settings.defaultShipping);
}

export function calculateCheckoutRewardDiscount(
  subtotal: number,
  reward: CheckoutReward
): number {
  const safeSubtotal = Math.max(0, Number(subtotal) || 0);
  if (!reward.enabled || safeSubtotal < reward.threshold) return 0;
  return Math.min(safeSubtotal, Math.round(safeSubtotal * (reward.discountPercent / 100) * 100) / 100);
}
