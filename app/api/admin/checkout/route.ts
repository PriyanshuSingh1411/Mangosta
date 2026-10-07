import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { isAuthenticated } from "@/app/lib/adminAuth";
import {
  DEFAULT_CHECKOUT_SETTINGS,
  getCheckoutSettings,
  saveCheckoutSettings,
} from "@/app/lib/dataStore";
import type { CheckoutSettings, ShippingRule, CheckoutReward } from "@/app/lib/dataStore";
import { DEFAULT_CHECKOUT_REWARDS } from "@/app/lib/dataStore";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function booleanValue(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}


function makeRewardCode(threshold: number) {
  return `MANGO-${Math.max(0, Math.round(threshold))}-${randomBytes(3).toString("hex").toUpperCase()}`;
}

function numberValue(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(0, value)
    : fallback;
}

export async function GET() {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const current = await getCheckoutSettings();
  const progressRewards = current.progressRewards.map((reward) =>
    reward.couponCode ? reward : { ...reward, couponCode: makeRewardCode(reward.threshold) }
  );
  if (progressRewards.some((reward, index) => reward.couponCode !== current.progressRewards[index]?.couponCode)) {
    const updated = { ...current, progressRewards };
    await saveCheckoutSettings(updated);
    return NextResponse.json(updated);
  }

  return NextResponse.json(current);
}

export async function PUT(req: NextRequest) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!isRecord(body)) {
    return NextResponse.json({ error: "Invalid body." }, { status: 400 });
  }

  const rawRules = Array.isArray(body.rules) ? body.rules : [];

  const rules: ShippingRule[] = rawRules
    .slice(0, 50)
    .map((value: unknown, index: number) => {
      const rule = isRecord(value) ? value : {};

      return {
        id:
          typeof rule.id === "string" && rule.id.trim()
            ? rule.id.trim()
            : `shipping-rule-${Date.now()}-${index}`,
        enabled: booleanValue(rule.enabled, true),
        minOrderValue: numberValue(rule.minOrderValue, 0),
        shippingCost: numberValue(rule.shippingCost, 0),
      };
    })
    .sort((a, b) => b.minOrderValue - a.minOrderValue)
    .map((rule, index) => ({
      ...rule,
      id: rule.id || `shipping-rule-${index + 1}`,
    }));

  const rawRewards = Array.isArray(body.progressRewards) ? body.progressRewards : DEFAULT_CHECKOUT_REWARDS;
  const rewards: CheckoutReward[] = rawRewards.slice(0, 3).map((value: unknown, index: number) => {
    const reward = isRecord(value) ? value : {};
    const fallback = DEFAULT_CHECKOUT_REWARDS[index] ?? DEFAULT_CHECKOUT_REWARDS[DEFAULT_CHECKOUT_REWARDS.length - 1];
    const threshold = numberValue(reward.threshold, fallback.threshold);
    const discountPercent = Math.min(100, numberValue(reward.discountPercent, fallback.discountPercent));
    const rawCode = typeof reward.couponCode === "string" ? reward.couponCode.trim().toUpperCase().replace(/\s+/g, "") : "";
    return {
      id: typeof reward.id === "string" && reward.id.trim() ? reward.id.trim() : `reward-${index + 1}`,
      enabled: booleanValue(reward.enabled, true),
      threshold,
      discountPercent,
      couponCode: rawCode || makeRewardCode(threshold),
    };
  }).sort((a, b) => a.threshold - b.threshold);

  const settings: CheckoutSettings = {
    enabled: booleanValue(body.enabled, DEFAULT_CHECKOUT_SETTINGS.enabled),
    defaultShipping: numberValue(
      body.defaultShipping,
      DEFAULT_CHECKOUT_SETTINGS.defaultShipping
    ),
    freeShippingEnabled: booleanValue(
      body.freeShippingEnabled,
      DEFAULT_CHECKOUT_SETTINGS.freeShippingEnabled
    ),
    freeShippingThreshold: numberValue(
      body.freeShippingThreshold,
      DEFAULT_CHECKOUT_SETTINGS.freeShippingThreshold
    ),
    rules,
    progressRewards: rewards,
  };

  await saveCheckoutSettings(settings);
  return NextResponse.json(settings);
}
