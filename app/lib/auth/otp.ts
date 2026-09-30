import { createHmac, randomInt } from "crypto";

export type OtpPurpose = "signup" | "signin";

export const OTP_TTL_MS = 10 * 60 * 1000;
export const OTP_RESEND_COOLDOWN_MS = 60 * 1000;
export const OTP_MAX_ATTEMPTS = 5;

export function normalizeEmail(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
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

export function generateSessionToken(): string {
  return createHmac("sha256", getOtpSecret())
    .update(`${Date.now()}:${randomInt(1_000_000, 9_999_999)}`)
    .digest("hex");
}
