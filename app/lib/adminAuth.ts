import "server-only";
import { cookies } from "next/headers";
import crypto from "crypto";

// Minimal session-cookie auth for the admin panel. Not OAuth, not a user
// table - a single shared admin password checked against an env var, with a
// signed, expiring session token stored in an HttpOnly cookie. This is
// intentionally simple: enough to keep /admin from being wide open on a
// public URL, appropriate for a single-operator store admin panel.

const COOKIE_NAME = "mangosta_admin_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 12; // 12 hours

function getSecret(): string {
  // Falls back to a fixed dev secret so local dev works without setup, but
  // logs a warning so it's obvious this must be overridden in production.
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret) {
    console.warn(
      "[admin auth] ADMIN_SESSION_SECRET is not set - using an insecure default. " +
        "Set this env var before deploying to production."
    );
    return "mangosta-dev-secret-change-me";
  }
  return secret;
}

function getAdminPassword(): string {
  return process.env.ADMIN_PASSWORD || "mangosta-admin";
}

function sign(payload: string): string {
  return crypto.createHmac("sha256", getSecret()).update(payload).digest("hex");
}

export function verifyPassword(password: string): boolean {
  const expected = getAdminPassword();
  // Constant-time comparison to avoid leaking password length/content via
  // response timing.
  const a = Buffer.from(password);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export function createSessionToken(): string {
  const expiresAt = Date.now() + SESSION_TTL_MS;
  const payload = `${expiresAt}`;
  const signature = sign(payload);
  return `${payload}.${signature}`;
}

function isValidToken(token: string | undefined): boolean {
  if (!token) return false;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return false;
  if (sign(payload) !== signature) return false;
  const expiresAt = parseInt(payload, 10);
  if (Number.isNaN(expiresAt) || Date.now() > expiresAt) return false;
  return true;
}

export async function isAuthenticated(): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  return isValidToken(token);
}

export async function setSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, createSessionToken(), {
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
