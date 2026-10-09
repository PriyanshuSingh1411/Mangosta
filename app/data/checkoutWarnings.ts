// Spots shipping settings that can never take effect (Admin → Checkout).
// Shared by the admin page (live warnings while editing) and the tests.
//
// How checkout picks the shipping charge (calculateShipping):
//   1. shipping charges switched off          → free
//   2. free shipping on and subtotal ≥ threshold → free
//   3. the enabled rule with the highest minimum ≤ subtotal → its charge
//   4. otherwise the default charge

export interface ShippingSettingsForWarnings {
  enabled: boolean;
  defaultShipping: number;
  freeShippingEnabled: boolean;
  freeShippingThreshold: number;
  rules: { id: string; enabled: boolean; minOrderValue: number; shippingCost: number }[];
}

function rupees(value: number): string {
  return `₹${Number(value || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

/**
 * Plain-language warnings, or [] when every setting can apply.
 * `cheapestPrice` (optional): the lowest product price in the shop, used to
 * spot a free-shipping threshold that every order already reaches.
 */
export function shippingSettingsWarnings(
  settings: ShippingSettingsForWarnings,
  cheapestPrice?: number | null
): string[] {
  const warnings: string[] = [];

  if (!settings.enabled) {
    warnings.push(
      "Shipping charges are switched off, so every order ships free and the charges below are never used."
    );
    return warnings;
  }

  const threshold = Math.max(0, Number(settings.freeShippingThreshold) || 0);
  const freeOn = settings.freeShippingEnabled;

  if (freeOn && threshold <= 0) {
    warnings.push(
      "Free shipping starts at ₹0, so every order ships free and the default charge and rules are never used."
    );
    return warnings;
  }

  if (freeOn && cheapestPrice != null && cheapestPrice > 0 && threshold <= cheapestPrice) {
    warnings.push(
      `Free shipping starts at ${rupees(threshold)}, which is at or below your cheapest product (${rupees(cheapestPrice)}). Every order reaches it, so every order ships free and the default charge and rules are never used.`
    );
  }

  const rules = settings.rules
    .map((rule, index) => ({ ...rule, label: `Rule ${String(index + 1).padStart(2, "0")}` }))
    .filter((rule) => rule.enabled);

  const seenMinimums = new Map<number, string>();
  for (const rule of [...rules].sort((a, b) => b.minOrderValue - a.minOrderValue)) {
    if (freeOn && rule.minOrderValue >= threshold) {
      warnings.push(
        `${rule.label} (${rupees(rule.shippingCost)} from ${rupees(rule.minOrderValue)}) can never apply: orders of ${rupees(threshold)} or more already ship free.`
      );
      continue;
    }

    const earlier = seenMinimums.get(rule.minOrderValue);
    if (earlier) {
      warnings.push(
        `${rule.label} has the same minimum order (${rupees(rule.minOrderValue)}) as ${earlier}, so it is never used.`
      );
      continue;
    }
    seenMinimums.set(rule.minOrderValue, rule.label);
  }

  if (rules.some((rule) => rule.minOrderValue <= 0 && !(freeOn && rule.minOrderValue >= threshold))) {
    warnings.push(
      "The default shipping charge is never used: a rule already applies from ₹0."
    );
  }

  return warnings;
}
