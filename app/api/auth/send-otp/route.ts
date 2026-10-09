import { NextRequest, NextResponse } from "next/server";
import clientPromise from "@/app/lib/mongodb";
import {
  generateOtp,
  hashOtp,
  normalizeEmail,
  normalizeMobile,
  isValidMobile,
  isValidEmail,
  OTP_MAX_ATTEMPTS,
  OTP_DAILY_WINDOW_MS,
  OTP_RATE_WINDOW_MS,
  OTP_RESEND_COOLDOWN_MS,
  OTP_SEND_DAILY_LIMIT_PER_EMAIL,
  OTP_SEND_LIMIT_PER_EMAIL,
  OTP_SEND_LIMIT_PER_IP,
  OTP_TTL_MS,
  type OtpPurpose,
} from "@/app/lib/auth/otp";
import { sendEmailOtp, sendNoAccountEmail } from "@/app/lib/auth/mail";
import { getSiteUrl } from "@/app/lib/db";
import { randomBytes } from "crypto";
import {
  consumeRateLimits,
  describeWait,
  getClientIp,
  type RateLimitRule,
} from "@/app/lib/rateLimit";
import type { Db } from "mongodb";

let indexesReady: Promise<void> | null = null;

/**
 * Creates the indexes once per server instance (not on every request).
 * The unique email index must exist; the TTL index only tidies up old
 * codes, so a database without TTL support doesn't break sign-in.
 */
function ensureAuthIndexes(db: Db): Promise<void> {
  if (!indexesReady) {
    indexesReady = (async () => {
      await db.collection("users").createIndex({ email: 1 }, { unique: true });

      try {
        await db
          .collection("otpVerifications")
          .createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
      } catch (error) {
        console.warn(
          "[send-otp] Could not create the TTL index on otpVerifications.expiresAt.",
          error instanceof Error ? error.message : error
        );
      }
    })().catch((error) => {
      // Try again on the next request.
      indexesReady = null;
      throw error;
    });
  }

  return indexesReady;
}

function tooManyRequests(retryAfterSeconds: number) {
  return NextResponse.json(
    {
      error: `Too many verification codes requested. Please try again in ${describeWait(retryAfterSeconds)}.`,
    },
    {
      status: 429,
      headers: { "Retry-After": String(retryAfterSeconds) },
    }
  );
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const email = normalizeEmail(body?.email);
    const purpose: OtpPurpose = body?.purpose === "signup" ? "signup" : "signin";
    const firstName = String(body?.firstName ?? "").trim();
    const lastName = String(body?.lastName ?? "").trim();
    const mobile = normalizeMobile(body?.mobile);

    if (!isValidEmail(email)) {
      return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
    }

    if (purpose === "signup" && (!firstName || !lastName)) {
      return NextResponse.json({ error: "First name and last name are required for sign up." }, { status: 400 });
    }

    if (purpose === "signup" && !isValidMobile(mobile)) {
      return NextResponse.json({ error: "Enter a valid 10-digit Indian mobile number." }, { status: 400 });
    }

    // Per network: limits mass requests for many different emails.
    const ipRule: RateLimitRule = {
      key: `otp-send:ip:${getClientIp(req)}`,
      limit: OTP_SEND_LIMIT_PER_IP,
      windowMs: OTP_RATE_WINDOW_MS,
    };
    const ipRate = await consumeRateLimits([ipRule]);

    if (!ipRate.allowed) {
      return tooManyRequests(ipRate.retryAfterSeconds);
    }

    const client = await clientPromise;
    const db = client.db("mangosta");

    await ensureAuthIndexes(db);

    // The reply below is the SAME whether or not an account exists, so this
    // form can't be used to find out who has an account. What differs is
    // only the email the inbox owner receives:
    //   sign in, account exists      → sign-in code
    //   sign in, no account          → "no account yet - create one" (no code)
    //   sign up, new email           → verification code (account created after it)
    //   sign up, account exists      → a code that simply signs them in
    // A mobile number already used by another account is checked after the
    // code is verified (verify-otp), not here.
    const user = await db.collection("users").findOne({ email });
    const noAccount = purpose === "signin" && !user;

    const latest = await db.collection("otpVerifications").findOne(
      { email, purpose, used: false },
      { sort: { createdAt: -1 } }
    );

    if (latest?.createdAt) {
      const createdAt = new Date(latest.createdAt).getTime();
      if (Date.now() - createdAt < OTP_RESEND_COOLDOWN_MS) {
        const waitSeconds = Math.ceil(
          (OTP_RESEND_COOLDOWN_MS - (Date.now() - createdAt)) / 1000
        );
        return NextResponse.json(
          { error: `Please wait ${waitSeconds} seconds before requesting another OTP.` },
          { status: 429 }
        );
      }
    }

    // Per email (hour + day): counted only when a code is really about to
    // be sent, so the 60-second wait above never uses up the allowance.
    // This is what caps guessing: each code allows OTP_MAX_ATTEMPTS tries.
    const emailRate = await consumeRateLimits([
      {
        key: `otp-send:email:${email}`,
        limit: OTP_SEND_LIMIT_PER_EMAIL,
        windowMs: OTP_RATE_WINDOW_MS,
      },
      {
        key: `otp-send:email-day:${email}`,
        limit: OTP_SEND_DAILY_LIMIT_PER_EMAIL,
        windowMs: OTP_DAILY_WINDOW_MS,
      },
    ]);

    if (!emailRate.allowed) {
      return tooManyRequests(emailRate.retryAfterSeconds);
    }

    const otp = generateOtp();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + OTP_TTL_MS);

    await db.collection("otpVerifications").updateMany(
      { email, purpose, used: false },
      { $set: { used: true } }
    );

    // Saved for every request (also "no account"), so the 60-second wait
    // and the limits behave the same either way. With no account, the hash
    // is of a random value nobody was sent, so no code can ever match it.
    await db.collection("otpVerifications").insertOne({
      email,
      purpose,
      otpHash: noAccount
        ? hashOtp(email, randomBytes(16).toString("hex"))
        : hashOtp(email, otp),
      firstName: purpose === "signup" ? firstName : "",
      lastName: purpose === "signup" ? lastName : "",
      mobile: purpose === "signup" ? mobile : "",
      ...(noAccount ? { noAccount: true } : {}),
      createdAt: now,
      expiresAt,
      attempts: 0,
      maxAttempts: OTP_MAX_ATTEMPTS,
      used: false,
    });

    if (noAccount) {
      await sendNoAccountEmail(email, getSiteUrl());
    } else {
      await sendEmailOtp(email, otp, purpose === "signup" && user ? "existing-account" : purpose);
    }

    return NextResponse.json({
      success: true,
      message:
        "Check your email: we've sent a 6-digit code. (If there's no account for this email yet, the email explains how to create one.)",
    });
  } catch (error) {
    console.error("POST /api/auth/send-otp failed:", error);
    return NextResponse.json(
      { error: "Unable to send the code right now. Please try again in a moment." },
      { status: 500 }
    );
  }
}
