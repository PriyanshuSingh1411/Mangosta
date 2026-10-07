import "server-only";

import { getStoreDb } from "@/app/lib/db";
import type { ProductCategory } from "@/app/data/productTypes";
import {
  DEFAULT_DELIVERY,
  DEFAULT_EMAIL_AUTOMATION,
  DEFAULT_RETURNS_POLICY,
  DEFAULT_SIZE_GUIDE,
  PRODUCT_CATEGORIES,
} from "@/app/data/storeTypes";
import type {
  DeliveryConfig,
  EmailAutomationConfig,
  PincodeRule,
  ReturnsPolicy,
  SizeChart,
  SizeGuideConfig,
} from "@/app/data/storeTypes";

// Store settings for the newer features, one document each in the
// "storeConfig" collection. Every value read or written goes through a
// normalizer, so missing / bad data always falls back to safe defaults.

export type StoreConfigKey =
  | "sizeGuide"
  | "delivery"
  | "returnsPolicy"
  | "emailAutomation";

type StoreConfigMap = {
  sizeGuide: SizeGuideConfig;
  delivery: DeliveryConfig;
  returnsPolicy: ReturnsPolicy;
  emailAutomation: EmailAutomationConfig;
};

export const STORE_CONFIG_KEYS: StoreConfigKey[] = [
  "sizeGuide",
  "delivery",
  "returnsPolicy",
  "emailAutomation",
];

// ------------------------------------------------------------------
// value helpers
// ------------------------------------------------------------------

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function text(value: unknown, fallback = "", max = 2000): string {
  return typeof value === "string" ? value.slice(0, max) : fallback;
}

function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function int(value: unknown, fallback: number, min: number, max: number): number {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, Math.round(number)));
}

// ------------------------------------------------------------------
// normalizers
// ------------------------------------------------------------------

function normalizeChart(value: unknown): SizeChart | undefined {
  if (!isRecord(value)) return undefined;

  const columns = (Array.isArray(value.columns) ? value.columns : [])
    .map((column) => text(column, "", 40).trim())
    .filter(Boolean)
    .slice(0, 8);

  const rows = (Array.isArray(value.rows) ? value.rows : [])
    .filter(isRecord)
    .map((row) => ({
      size: text(row.size, "", 20).trim(),
      values: columns.map((_, index) =>
        text(Array.isArray(row.values) ? row.values[index] : "", "", 20).trim()
      ),
    }))
    .filter((row) => row.size)
    .slice(0, 20);

  return { columns, rows, note: text(value.note, "", 500) };
}

export function normalizeSizeGuide(value: unknown): SizeGuideConfig {
  const source = isRecord(value) ? value : {};
  const rawCharts = isRecord(source.charts) ? source.charts : {};
  const charts: SizeGuideConfig["charts"] = {};

  for (const category of PRODUCT_CATEGORIES) {
    const chart = normalizeChart(rawCharts[category]);
    if (chart && chart.columns.length > 0) {
      charts[category as ProductCategory] = chart;
    }
  }

  return {
    unit: source.unit === "in" ? "in" : "cm",
    howToMeasure: text(source.howToMeasure, DEFAULT_SIZE_GUIDE.howToMeasure, 1000),
    charts,
  };
}

function normalizeRule(value: unknown, index: number): PincodeRule | null {
  if (!isRecord(value)) return null;

  const prefix = text(value.prefix, "", 6).replace(/\D/g, "").slice(0, 6);
  if (!prefix) return null;

  const minDays = int(value.minDays, DEFAULT_DELIVERY.defaultMinDays, 0, 60);

  return {
    id: text(value.id, "", 60) || `rule-${index + 1}`,
    prefix,
    label: text(value.label, "", 60).trim(),
    minDays,
    maxDays: Math.max(minDays, int(value.maxDays, minDays, 0, 90)),
    cod: bool(value.cod, true),
    serviceable: bool(value.serviceable, true),
  };
}

export function normalizeDelivery(value: unknown): DeliveryConfig {
  const source = isRecord(value) ? value : {};
  const minDays = int(source.defaultMinDays, DEFAULT_DELIVERY.defaultMinDays, 0, 60);

  return {
    enabled: bool(source.enabled, DEFAULT_DELIVERY.enabled),
    deliverEverywhere: bool(source.deliverEverywhere, DEFAULT_DELIVERY.deliverEverywhere),
    defaultMinDays: minDays,
    defaultMaxDays: Math.max(
      minDays,
      int(source.defaultMaxDays, DEFAULT_DELIVERY.defaultMaxDays, 0, 90)
    ),
    defaultCod: bool(source.defaultCod, DEFAULT_DELIVERY.defaultCod),
    rules: (Array.isArray(source.rules) ? source.rules : [])
      .slice(0, 300)
      .map(normalizeRule)
      .filter((rule): rule is PincodeRule => rule !== null),
  };
}

export function normalizeReturnsPolicy(value: unknown): ReturnsPolicy {
  const source = isRecord(value) ? value : {};
  const reasons = (Array.isArray(source.reasons) ? source.reasons : DEFAULT_RETURNS_POLICY.reasons)
    .map((reason) => text(reason, "", 80).trim())
    .filter(Boolean)
    .slice(0, 12);

  return {
    enabled: bool(source.enabled, DEFAULT_RETURNS_POLICY.enabled),
    windowDays: int(source.windowDays, DEFAULT_RETURNS_POLICY.windowDays, 1, 90),
    allowReturns: bool(source.allowReturns, DEFAULT_RETURNS_POLICY.allowReturns),
    allowExchanges: bool(source.allowExchanges, DEFAULT_RETURNS_POLICY.allowExchanges),
    reasons: reasons.length > 0 ? reasons : DEFAULT_RETURNS_POLICY.reasons,
    policyText: text(source.policyText, DEFAULT_RETURNS_POLICY.policyText, 1500),
  };
}

export function normalizeEmailAutomation(value: unknown): EmailAutomationConfig {
  const source = isRecord(value) ? value : {};
  const d = DEFAULT_EMAIL_AUTOMATION;

  return {
    abandonedBagEnabled: bool(source.abandonedBagEnabled, d.abandonedBagEnabled),
    abandonedBagDelayHours: int(source.abandonedBagDelayHours, d.abandonedBagDelayHours, 24, 168),
    abandonedBagSubject: text(source.abandonedBagSubject, d.abandonedBagSubject, 150) || d.abandonedBagSubject,
    abandonedBagHeading: text(source.abandonedBagHeading, d.abandonedBagHeading, 120),
    abandonedBagBody: text(source.abandonedBagBody, d.abandonedBagBody, 1500),
    abandonedBagButtonText: text(source.abandonedBagButtonText, d.abandonedBagButtonText, 40) || d.abandonedBagButtonText,
    backInStockEnabled: bool(source.backInStockEnabled, d.backInStockEnabled),
    backInStockSubject: text(source.backInStockSubject, d.backInStockSubject, 150) || d.backInStockSubject,
  };
}

const NORMALIZERS: { [K in StoreConfigKey]: (value: unknown) => StoreConfigMap[K] } = {
  sizeGuide: normalizeSizeGuide,
  delivery: normalizeDelivery,
  returnsPolicy: normalizeReturnsPolicy,
  emailAutomation: normalizeEmailAutomation,
};

export function isStoreConfigKey(value: unknown): value is StoreConfigKey {
  return STORE_CONFIG_KEYS.includes(value as StoreConfigKey);
}

// ------------------------------------------------------------------
// read / write
// ------------------------------------------------------------------

export async function getStoreConfig<K extends StoreConfigKey>(
  key: K
): Promise<StoreConfigMap[K]> {
  const db = await getStoreDb();
  const saved = await db
    .collection<{ _id: string; value: unknown }>("storeConfig")
    .findOne({ _id: key });

  return NORMALIZERS[key](saved?.value) as StoreConfigMap[K];
}

export async function saveStoreConfig<K extends StoreConfigKey>(
  key: K,
  value: unknown
): Promise<StoreConfigMap[K]> {
  const normalized = NORMALIZERS[key](value) as StoreConfigMap[K];
  const db = await getStoreDb();

  await db
    .collection<{ _id: string; value: unknown; updatedAt: Date }>("storeConfig")
    .updateOne(
      { _id: key },
      { $set: { value: normalized, updatedAt: new Date() } },
      { upsert: true }
    );

  return normalized;
}
