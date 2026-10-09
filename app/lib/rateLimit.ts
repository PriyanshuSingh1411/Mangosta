import "server-only";
import { createHash } from "crypto";
import type { NextRequest } from "next/server";
import clientPromise from "@/app/lib/mongodb";

// Request limits stored in MongoDB, so they hold across every serverless
// instance (an in-memory counter would reset on each cold start).
//
// Fixed time windows: a rule "limit 5 per hour" allows at most 5 requests
// in each clock-aligned hour. Each request is counted with ONE atomic
// database step ($inc), so parallel requests can't slip past the limit.
//
// Keys are stored hashed (no raw email addresses or IPs in this collection),
// and each window's record expires on its own (TTL index on expiresAt).

const COLLECTION = "rateLimits";

type RateLimitDocument = {
  _id: string;
  count: number;
  expiresAt: Date;
};

export interface RateLimitRule {
  /** What is limited, e.g. `otp-verify:email:${email}`. Hashed before storage. */
  key: string;
  /** Requests allowed in each window. */
  limit: number;
  /** Window length in milliseconds. */
  windowMs: number;
  /**
   * Shifts where windows start, e.g. IST_DAY_OFFSET_MS so daily windows
   * start at midnight in India instead of midnight UTC. Default 0.
   */
  offsetMs?: number;
}

/** For daily limits: windows start at 00:00 India time (UTC+5:30). */
export const IST_DAY_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;

export interface RateLimitResult {
  allowed: boolean;
  /** Seconds until the blocking window ends (0 when allowed). */
  retryAfterSeconds: number;
}

let indexReady: Promise<void> | null = null;

async function getCollection() {
  const client = await clientPromise;
  const collection = client
    .db("mangosta")
    .collection<RateLimitDocument>(COLLECTION);

  if (!indexReady) {
    indexReady = collection
      .createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 })
      .then(() => undefined)
      .catch((error) => {
        // Limits still work without it; old windows just aren't purged
        // automatically (e.g. a local database without TTL support).
        console.warn(
          "[rate limit] Could not create the TTL index on rateLimits.expiresAt.",
          error instanceof Error ? error.message : error
        );
      });
  }

  await indexReady;
  return collection;
}

function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: unknown }).code === 11000
  );
}

function hashKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

async function countRequest(rule: RateLimitRule): Promise<RateLimitResult> {
  const collection = await getCollection();
  const now = Date.now();
  const offset = rule.offsetMs ?? 0;
  const windowStart =
    Math.floor((now + offset) / rule.windowMs) * rule.windowMs - offset;
  const windowEnd = windowStart + rule.windowMs;
  const id = `${hashKey(rule.key)}:${rule.windowMs}:${windowStart}`;

  const increment = () =>
    collection.findOneAndUpdate(
      { _id: id },
      {
        $inc: { count: 1 },
        $setOnInsert: { expiresAt: new Date(windowEnd) },
      },
      { upsert: true, returnDocument: "after" }
    );

  let record: RateLimitDocument | null;

  try {
    record = await increment();
  } catch (error) {
    // Two first requests of a window at the same moment: one created the
    // record, so the other just increments it.
    if (!isDuplicateKeyError(error)) throw error;
    record = await increment();
  }

  const count = Number(record?.count ?? 1);
  const allowed = count <= rule.limit;

  return {
    allowed,
    retryAfterSeconds: allowed
      ? 0
      : Math.max(1, Math.ceil((windowEnd - now) / 1000)),
  };
}

/**
 * Counts this request against every rule. Blocked when ANY rule is over
 * its limit (retryAfterSeconds is then the longest wait).
 */
export async function consumeRateLimits(
  rules: RateLimitRule[]
): Promise<RateLimitResult> {
  const results = await Promise.all(rules.map(countRequest));
  const blocked = results.filter((result) => !result.allowed);

  if (blocked.length === 0) {
    return { allowed: true, retryAfterSeconds: 0 };
  }

  return {
    allowed: false,
    retryAfterSeconds: Math.max(
      ...blocked.map((result) => result.retryAfterSeconds)
    ),
  };
}

/**
 * The visitor's IP address. On Vercel, x-forwarded-for / x-real-ip are set
 * by Vercel itself (the first x-forwarded-for entry is the visitor).
 */
export function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  const first = forwarded?.split(",")[0]?.trim();

  return first || req.headers.get("x-real-ip")?.trim() || "unknown";
}

/** "3 hours", "15 minutes", "1 minute", "40 seconds" - for the customer message. */
export function describeWait(seconds: number): string {
  if (seconds >= 2 * 60 * 60) {
    const hours = Math.ceil(seconds / 3600);
    return `${hours} hours`;
  }

  if (seconds >= 60) {
    const minutes = Math.ceil(seconds / 60);
    return `${minutes} minute${minutes === 1 ? "" : "s"}`;
  }

  return `${seconds} second${seconds === 1 ? "" : "s"}`;
}
