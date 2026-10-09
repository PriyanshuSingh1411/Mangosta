import "server-only";
import { createHash, randomBytes } from "crypto";
import clientPromise from "@/app/lib/mongodb";

// Admin password guessing protection.
//
//   Per network:  5 wrong passwords within 15 minutes → that network is
//                 blocked for 15 minutes.
//   Everywhere:   50 wrong passwords within an hour (all networks
//                 together) → every admin login is paused for an hour.
//
// Each login attempt is saved as its own record ("adminLoginAttempts")
// BEFORE the password is checked, and then the recent records are counted.
// A request only gets its password checked when its count is within the
// limit, so however many guesses arrive at the same moment, no more than
// the limit are checked (every request counts after its own record is
// saved, so the later of any two always sees the earlier one). Attempts
// refused without a check are deleted again, so only real wrong passwords
// count. A correct password deletes its network's records.
// Blocks are kept in "adminLoginGuard" (blockedUntil per network / "all").

const ATTEMPTS = "adminLoginAttempts";
const BLOCKS = "adminLoginGuard";

export const ADMIN_LOGIN_NETWORK_LIMIT = 5;
const NETWORK_WINDOW_MS = 15 * 60 * 1000;
const NETWORK_BLOCK_MS = 15 * 60 * 1000;

export const ADMIN_LOGIN_GLOBAL_LIMIT = 50;
const GLOBAL_WINDOW_MS = 60 * 60 * 1000;
const GLOBAL_BLOCK_MS = 60 * 60 * 1000;

const GLOBAL_KEY = "all";

type AttemptDocument = {
  _id: string;
  key: string;
  at: Date;
  /** Deleted automatically after this (TTL index), if the database supports it. */
  expiresAt: Date;
};

type BlockDocument = { _id: string; blockedUntil: Date };

export type AdminLoginBlock = {
  scope: "network" | "everywhere";
  retryAfterSeconds: number;
};

export type AdminLoginAttempt =
  | { allowed: true; attemptId: string; networkKey: string }
  | { allowed: false; block: AdminLoginBlock };

let indexesReady: Promise<void> | null = null;

async function collections() {
  const client = await clientPromise;
  const db = client.db("mangosta");
  const attempts = db.collection<AttemptDocument>(ATTEMPTS);
  const blocks = db.collection<BlockDocument>(BLOCKS);

  if (!indexesReady) {
    indexesReady = (async () => {
      await attempts.createIndex({ key: 1, at: 1 });
      try {
        await attempts.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
      } catch (error) {
        // Counting still works without it; old records just stay.
        console.warn(
          "[admin login] Could not create the TTL index on adminLoginAttempts.",
          error instanceof Error ? error.message : error
        );
      }
    })().catch((error) => {
      indexesReady = null;
      throw error;
    });
  }

  await indexesReady;
  return { attempts, blocks };
}

function networkKey(ip: string): string {
  return `net:${createHash("sha256").update(ip).digest("hex")}`;
}

function secondsUntil(date: Date, now: number): number {
  return Math.max(1, Math.ceil((date.getTime() - now) / 1000));
}

function activeBlock(document: BlockDocument | null, now: number): Date | null {
  const until = document?.blockedUntil ? new Date(document.blockedUntil) : null;
  return until && until.getTime() > now ? until : null;
}

/** Records the attempt and says whether its password may be checked. */
export async function startAdminLoginAttempt(ip: string): Promise<AdminLoginAttempt> {
  const { attempts, blocks } = await collections();
  const now = Date.now();
  const at = new Date(now);
  const attemptId = randomBytes(9).toString("hex");
  const netKey = networkKey(ip);

  // 1. Save the attempt (network + everywhere) before anything is checked.
  await attempts.insertMany([
    { _id: `${attemptId}:net`, key: netKey, at, expiresAt: new Date(now + NETWORK_WINDOW_MS) },
    { _id: `${attemptId}:all`, key: GLOBAL_KEY, at, expiresAt: new Date(now + GLOBAL_WINDOW_MS) },
  ]);

  // Refused without checking the password → doesn't count as a wrong one.
  const refuse = async (block: AdminLoginBlock): Promise<AdminLoginAttempt> => {
    await attempts.deleteMany({ _id: { $in: [`${attemptId}:net`, `${attemptId}:all`] } });
    return { allowed: false, block };
  };

  // 2. Already blocked?
  const [networkBlock, globalBlock] = await Promise.all([
    blocks.findOne({ _id: netKey }),
    blocks.findOne({ _id: GLOBAL_KEY }),
  ]);
  const globalUntil = activeBlock(globalBlock, now);
  if (globalUntil) {
    return refuse({ scope: "everywhere", retryAfterSeconds: secondsUntil(globalUntil, now) });
  }
  const networkUntil = activeBlock(networkBlock, now);
  if (networkUntil) {
    return refuse({ scope: "network", retryAfterSeconds: secondsUntil(networkUntil, now) });
  }

  // 3. Count recent attempts, this one included.
  const [networkCount, globalCount] = await Promise.all([
    attempts.countDocuments({ key: netKey, at: { $gt: new Date(now - NETWORK_WINDOW_MS) } }),
    attempts.countDocuments({ key: GLOBAL_KEY, at: { $gt: new Date(now - GLOBAL_WINDOW_MS) } }),
  ]);

  if (globalCount > ADMIN_LOGIN_GLOBAL_LIMIT) {
    return refuse({ scope: "everywhere", retryAfterSeconds: GLOBAL_BLOCK_MS / 1000 });
  }
  if (networkCount > ADMIN_LOGIN_NETWORK_LIMIT) {
    return refuse({ scope: "network", retryAfterSeconds: NETWORK_BLOCK_MS / 1000 });
  }

  return { allowed: true, attemptId, networkKey: netKey };
}

/**
 * The password was wrong. Its attempt stays counted; reaching the limit
 * blocks the network (5 in 15 min) or every login (50 in an hour).
 * Returns the block, if there now is one.
 */
export async function failAdminLoginAttempt(
  attempt: Extract<AdminLoginAttempt, { allowed: true }>
): Promise<AdminLoginBlock | null> {
  const { attempts, blocks } = await collections();
  const now = Date.now();

  const [networkCount, globalCount] = await Promise.all([
    attempts.countDocuments({ key: attempt.networkKey, at: { $gt: new Date(now - NETWORK_WINDOW_MS) } }),
    attempts.countDocuments({ key: GLOBAL_KEY, at: { $gt: new Date(now - GLOBAL_WINDOW_MS) } }),
  ]);

  if (globalCount >= ADMIN_LOGIN_GLOBAL_LIMIT) {
    const until = new Date(now + GLOBAL_BLOCK_MS);
    await blocks.updateOne({ _id: GLOBAL_KEY }, { $max: { blockedUntil: until } }, { upsert: true });
    console.warn("[admin login] 50 wrong passwords within an hour - admin login paused for 1 hour.");
    return { scope: "everywhere", retryAfterSeconds: secondsUntil(until, now) };
  }

  if (networkCount >= ADMIN_LOGIN_NETWORK_LIMIT) {
    const until = new Date(now + NETWORK_BLOCK_MS);
    await blocks.updateOne({ _id: attempt.networkKey }, { $max: { blockedUntil: until } }, { upsert: true });
    return { scope: "network", retryAfterSeconds: secondsUntil(until, now) };
  }

  return null;
}

/** The password was right: forget this network's wrong tries and this attempt. */
export async function succeedAdminLoginAttempt(
  attempt: Extract<AdminLoginAttempt, { allowed: true }>
): Promise<void> {
  const { attempts } = await collections();

  await Promise.all([
    attempts.deleteMany({ key: attempt.networkKey }),
    attempts.deleteOne({ _id: `${attempt.attemptId}:all` }),
  ]);
}

/** "15 minutes", "1 minute", "40 seconds". */
export function describeAdminWait(seconds: number): string {
  if (seconds >= 60) {
    const minutes = Math.ceil(seconds / 60);
    return `${minutes} minute${minutes === 1 ? "" : "s"}`;
  }
  return `${seconds} second${seconds === 1 ? "" : "s"}`;
}
