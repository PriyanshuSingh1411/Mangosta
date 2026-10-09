import "server-only";

import { readFile } from "fs/promises";
import path from "path";
import clientPromise from "@/app/lib/mongodb";

// Shared database helpers for the store modules: the database handle, one-time
// JSON-import migrations, transaction support and small utilities.

// Server-only. Runtime-managed data is stored in MongoDB so this works on Vercel.
// Local JSON files are read only for one-time migration / fallback purposes.
const DATA_DIR = path.join(process.cwd(), "data");
export const PRODUCTS_PATH = path.join(DATA_DIR, "products.json");
export const ORDERS_PATH = path.join(DATA_DIR, "orders.json");
export const COUPONS_PATH = path.join(DATA_DIR, "coupons.json");
export const SETTINGS_PATH = path.join(DATA_DIR, "settings.json");
export const CHECKOUT_SETTINGS_PATH = path.join(DATA_DIR, "checkout.json");

const DB_NAME = "mangosta";

// -----------------------------------------------------------------------------
// MongoDB document types
// -----------------------------------------------------------------------------

type MigrationDocument = {
  _id: string;
  completedAt: Date;
};

// -----------------------------------------------------------------------------
// Shared helpers
// -----------------------------------------------------------------------------

export async function getDb() {
  const client = await clientPromise;
  return client.db(DB_NAME);
}

export async function readJson<T>(
  filePath: string,
  fallback: T
): Promise<T> {
  try {
    const raw = await readFile(filePath, "utf-8");
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

// One-time data migrations (e.g. importing the old JSON files) record
// themselves in the "migrations" collection. Once one is known to be done,
// this server instance remembers it, so normal reads don't query the
// "migrations" collection every time.
const completedMigrations = new Set<string>();

export async function isMigrated(
  migrationId: string
): Promise<boolean> {
  if (completedMigrations.has(migrationId)) return true;

  const db = await getDb();
  const collection = db.collection<MigrationDocument>("migrations");
  const result = await collection.findOne({
    _id: migrationId,
  });

  if (result) completedMigrations.add(migrationId);
  return Boolean(result);
}

export async function markMigrated(
  migrationId: string
): Promise<void> {
  const db = await getDb();
  const collection = db.collection<MigrationDocument>("migrations");

  await collection.updateOne(
    { _id: migrationId },
    { $set: { completedAt: new Date() } },
    { upsert: true }
  );

  completedMigrations.add(migrationId);
}

export function omitMongoId<T extends { _id?: unknown }>(
  document: T
): Omit<T, "_id"> {
  const copy: Partial<T> = { ...document };
  delete copy._id;
  return copy as Omit<T, "_id">;
}

let transactionSupport: Promise<boolean> | null = null;
let warnedNoTransactions = false;

/** Logged once per server: orders fall back to compensating rollback. */
export function warnOnceNoTransactions(): void {
  if (warnedNoTransactions) return;
  warnedNoTransactions = true;
  console.warn(
    "[INVENTORY] This MongoDB server does not support transactions (standalone mongod). Orders use compensating rollback instead. Use MongoDB Atlas or a replica set in production."
  );
}

/**
 * Multi-document transactions need a replica set or sharded cluster.
 * MongoDB Atlas (any tier) is always a replica set. A plain local
 * `mongod` is standalone and cannot run transactions.
 */
export function supportsTransactions(): Promise<boolean> {
  if (!transactionSupport) {
    transactionSupport = (async () => {
      const db = await getDb();
      const hello = await db.command({ hello: 1 });

      return (
        Boolean(hello.setName) ||
        hello.msg === "isdbgrid"
      );
    })().catch((error) => {
      // Detect again on the next order instead of caching a failure.
      transactionSupport = null;
      throw error;
    });
  }

  return transactionSupport;
}

export function isDuplicateKeyError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: unknown }).code === 11000
  );
}

export function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
