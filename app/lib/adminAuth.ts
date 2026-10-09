import "server-only";
import { cookies } from "next/headers";
import crypto from "crypto";
import clientPromise from "@/app/lib/mongodb";

// Minimal session-cookie auth for the admin panel. Not OAuth, not a user
// table - a single shared admin password checked against an env var, with a
// signed, expiring session token stored in an HttpOnly cookie. This is
// intentionally simple: enough to keep /admin from being wide open on a
// public URL, appropriate for a single-operator store admin panel.
//
// Ending sessions:
//   - Token = "<expiresAt>.<version>.<signature>". The version must match
//     the one stored in the database ("adminAuth" collection), and logging
//     out raises it - so logout ends EVERY admin session, including any
//     copied cookie.
//   - The signature key is made from ADMIN_SESSION_SECRET + ADMIN_PASSWORD,
//     so changing either one (and redeploying) also ends every session.

const COOKIE_NAME = "mangosta_admin_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 12; // 12 hours

// Local development only. In production these are NEVER used: the live
// site must have ADMIN_PASSWORD and ADMIN_SESSION_SECRET set, otherwise
// admin login and every admin session are refused (see adminAuthConfigured).
const DEV_FALLBACK_SECRET = "mangosta-dev-secret-change-me";
const DEV_FALLBACK_PASSWORD = "mangosta-admin";

const isProduction = process.env.NODE_ENV === "production";

let warnedMissingConfig = false;

/**
 * True when admin login can be used safely. In production both
 * ADMIN_PASSWORD and ADMIN_SESSION_SECRET must be set; without them the
 * built-in fallbacks (which are public in this code) would let anyone in.
 */
export function adminAuthConfigured(): boolean {
  const configured = Boolean(
    process.env.ADMIN_PASSWORD && process.env.ADMIN_SESSION_SECRET
  );

  if (!configured && !warnedMissingConfig) {
    warnedMissingConfig = true;
    if (isProduction) {
      console.error(
        "[admin auth] ADMIN_PASSWORD and/or ADMIN_SESSION_SECRET is not set. " +
          "Admin login is DISABLED until both are set in the environment variables."
      );
    } else {
      console.warn(
        "[admin auth] ADMIN_PASSWORD and/or ADMIN_SESSION_SECRET is not set - " +
          "using insecure local-development defaults. Production refuses to run without them."
      );
    }
  }

  return configured || !isProduction;
}

function getSecret(): string {
  return process.env.ADMIN_SESSION_SECRET || DEV_FALLBACK_SECRET;
}

function getAdminPassword(): string {
  return process.env.ADMIN_PASSWORD || DEV_FALLBACK_PASSWORD;
}

function signingKey(): Buffer {
  // Changing the password (or the secret) changes this key, which makes
  // every existing session cookie invalid.
  return crypto
    .createHash("sha256")
    .update(`${getSecret()}\n${getAdminPassword()}`)
    .digest();
}

function sign(payload: string): string {
  return crypto.createHmac("sha256", signingKey()).update(payload).digest("hex");
}

const SESSION_VERSION_ID = "session";

type AdminAuthDocument = { _id: string; version: number };

async function adminAuthCollection() {
  const client = await clientPromise;
  return client.db("mangosta").collection<AdminAuthDocument>("adminAuth");
}

/** Current admin session version (sessions with another version are ended). */
async function getSessionVersion(): Promise<number> {
  const collection = await adminAuthCollection();
  const document = await collection.findOne({ _id: SESSION_VERSION_ID });
  return Number(document?.version) || 0;
}

/** Ends every admin session on every device (logout). */
export async function endAllAdminSessions(): Promise<void> {
  const collection = await adminAuthCollection();
  await collection.updateOne(
    { _id: SESSION_VERSION_ID },
    { $inc: { version: 1 } },
    { upsert: true }
  );
}

export function verifyPassword(password: string): boolean {
  // Production without both env vars: nobody can log in.
  if (!adminAuthConfigured()) return false;

  const expected = getAdminPassword();
  // Constant-time comparison to avoid leaking password length/content via
  // response timing.
  const a = Buffer.from(password);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

async function createSessionToken(): Promise<string> {
  const expiresAt = Date.now() + SESSION_TTL_MS;
  const version = await getSessionVersion();
  const payload = `${expiresAt}.${version}`;
  const signature = sign(payload);
  return `${payload}.${signature}`;
}

async function isValidToken(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  // Production without both env vars: no admin session is accepted, so a
  // cookie signed with the public fallback secret can't get in either.
  if (!adminAuthConfigured()) return false;

  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [expiresPart, versionPart, signature] = parts;

  // Constant-time signature check.
  const expected = Buffer.from(sign(`${expiresPart}.${versionPart}`));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) {
    return false;
  }

  const expiresAt = Number(expiresPart);
  if (!Number.isFinite(expiresAt) || Date.now() > expiresAt) return false;

  // Ended by a logout since it was issued? (Database unreachable → no access.)
  try {
    return Number(versionPart) === (await getSessionVersion());
  } catch (error) {
    console.error("[admin auth] Could not check the admin session version.", error);
    return false;
  }
}

export async function isAuthenticated(): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  return isValidToken(token);
}

export async function setSessionCookie(): Promise<void> {
  if (!adminAuthConfigured()) {
    throw new Error("Admin login is not configured.");
  }
  const token = await createSessionToken();
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}
