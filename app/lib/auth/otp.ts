import { createHmac, randomInt } from "crypto";

export type OtpPurpose = "signup" | "signin";

export const OTP_TTL_MS = 10 * 60 * 1000;
export const OTP_RESEND_COOLDOWN_MS = 60 * 1000;
export const OTP_MAX_ATTEMPTS = 5;

/**
 * Request limits for sign-in / sign-up codes (counted per clock hour /
 * per calendar day, UTC).
 *
 * Guessing: each code allows OTP_MAX_ATTEMPTS tries, and only this many
 * codes can be sent to one email - so at most 5 x 5 = 25 guesses per hour
 * and 20 x 5 = 100 per day against any email, however many networks or
 * devices are used.
 *
 * Verify requests are limited per network, and per email FROM that
 * network (not per email alone), so a stranger sending junk codes for
 * someone's email can't lock that customer out of signing in.
 */
export const OTP_RATE_WINDOW_MS = 60 * 60 * 1000;
export const OTP_DAILY_WINDOW_MS = 24 * 60 * 60 * 1000;
export const OTP_SEND_LIMIT_PER_EMAIL = 5;
export const OTP_SEND_DAILY_LIMIT_PER_EMAIL = 20;
export const OTP_SEND_LIMIT_PER_IP = 30;
export const OTP_VERIFY_LIMIT_PER_EMAIL_AND_IP = 20;
export const OTP_VERIFY_LIMIT_PER_IP = 60;

export function normalizeEmail(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

/**
 * Normal addresses only (e.g. name.surname+tag@domain.co.in).
 * Quoted names, comments, <brackets>, spaces and anything longer than
 * 254 characters are rejected before an address ever reaches the mailer.
 * The length is checked first, so the pattern only ever sees short input.
 */
const EMAIL_PATTERN =
  /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/i;

export function isValidEmail(value: unknown): boolean {
  const email = String(value ?? "");
  return email.length <= 254 && EMAIL_PATTERN.test(email);
}

export function normalizeMobile(value: unknown): string {
  const raw = String(value ?? "").trim();
  if (!raw) return "";

  const digits = raw.replace(/\D/g, "");

  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith("91")) return `+${digits}`;

  return raw.startsWith("+") ? `+${digits}` : `+${digits}`;
}

export function isValidMobile(value: unknown): boolean {
  return /^\+91[6-9]\d{9}$/.test(normalizeMobile(value));
}

export function generateOtp(): string {
  return String(randomInt(100000, 1000000));
}

function getOtpSecret(): string {
  const secret = process.env.OTP_SECRET;

  if (!secret) {
    throw new Error("Please add OTP_SECRET to .env.local");
  }

  return secret;
}

export function hashOtp(email: string, otp: string): string {
  return createHmac("sha256", getOtpSecret())
    .update(`${normalizeEmail(email)}:${otp}`)
    .digest("hex");
}

export function hashSessionToken(token: string): string {
  return createHmac("sha256", getOtpSecret())
    .update(token)
    .digest("hex");
}
