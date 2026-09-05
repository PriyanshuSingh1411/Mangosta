import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/app/lib/adminAuth";
import {
  DEFAULT_CHECKOUT_SETTINGS,
  getCheckoutSettings,
  saveCheckoutSettings,
} from "@/app/lib/dataStore";
import type { CheckoutSettings, ShippingRule } from "@/app/lib/dataStore";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function booleanValue(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
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

  return NextResponse.json(await getCheckoutSettings());
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
  };

  await saveCheckoutSettings(settings);
  return NextResponse.json(settings);
}
