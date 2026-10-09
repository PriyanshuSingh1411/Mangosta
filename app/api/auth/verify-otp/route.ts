import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import clientPromise from "@/app/lib/mongodb";
import {
  hashOtp,
  normalizeEmail,
  normalizeMobile,
  isValidMobile,
  isValidEmail,
  OTP_MAX_ATTEMPTS,
  OTP_RATE_WINDOW_MS,
  OTP_VERIFY_LIMIT_PER_EMAIL_AND_IP,
  OTP_VERIFY_LIMIT_PER_IP,
  type OtpPurpose,
} from "@/app/lib/auth/otp";
import { createSession } from "@/app/lib/auth/session";
import {
  consumeRateLimits,
  describeWait,
  getClientIp,
} from "@/app/lib/rateLimit";

/** Both are hex SHA-256 HMACs; compared in constant time. */
function hashesMatch(stored: unknown, expected: string): boolean {
  if (typeof stored !== "string" || stored.length !== expected.length) {
    return false;
  }

  return timingSafeEqual(Buffer.from(stored), Buffer.from(expected));
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const email = normalizeEmail(body?.email);
    const otp = String(body?.otp ?? "").trim();
    const purpose: OtpPurpose = body?.purpose === "signup" ? "signup" : "signin";
    const mobile = normalizeMobile(body?.mobile);

    if (!isValidEmail(email)) {
      return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
    }

    if (purpose === "signup" && !isValidMobile(mobile)) {
      return NextResponse.json({ error: "Enter a valid 10-digit Indian mobile number." }, { status: 400 });
    }

    if (!/^\d{6}$/.test(otp)) {
      return NextResponse.json({ error: "Enter the 6-digit OTP." }, { status: 400 });
    }

    // Per network, and per email from that network. Guesses per email in
    // total are capped by the code limits (see OTP_SEND_LIMIT_PER_EMAIL).
    const clientIp = getClientIp(req);
    const rate = await consumeRateLimits([
      {
        key: `otp-verify:ip:${clientIp}`,
        limit: OTP_VERIFY_LIMIT_PER_IP,
        windowMs: OTP_RATE_WINDOW_MS,
      },
      {
        key: `otp-verify:email-ip:${email}|${clientIp}`,
        limit: OTP_VERIFY_LIMIT_PER_EMAIL_AND_IP,
        windowMs: OTP_RATE_WINDOW_MS,
      },
    ]);

    if (!rate.allowed) {
      return NextResponse.json(
        {
          error: `Too many attempts. Please try again in ${describeWait(rate.retryAfterSeconds)}.`,
        },
        {
          status: 429,
          headers: { "Retry-After": String(rate.retryAfterSeconds) },
        }
      );
    }

    const client = await clientPromise;
    const db = client.db("mangosta");
    const otpVerifications = db.collection("otpVerifications");

    const verification = await otpVerifications.findOne(
      { email, purpose, used: false },
      { sort: { createdAt: -1 } }
    );

    if (!verification) {
      return NextResponse.json({ error: "OTP is invalid or has expired. Please request a new one." }, { status: 400 });
    }

    if (new Date(verification.expiresAt).getTime() <= Date.now()) {
      await otpVerifications.updateOne(
        { _id: verification._id },
        { $set: { used: true } }
      );
      return NextResponse.json({ error: "OTP has expired. Please request a new one." }, { status: 400 });
    }

    const maxAttempts = Number(verification.maxAttempts || OTP_MAX_ATTEMPTS);

    // Reserve this attempt in ONE database step BEFORE comparing: the
    // counter only goes up while it is below the limit, so however many
    // guesses arrive at the same moment, at most maxAttempts get checked.
    const reserved = await otpVerifications.findOneAndUpdate(
      {
        _id: verification._id,
        used: false,
        $or: [
          { attempts: { $lt: maxAttempts } },
          { attempts: { $exists: false } },
        ],
      },
      { $inc: { attempts: 1 } },
      { returnDocument: "after" }
    );

    if (!reserved) {
      // No attempt left, or the code was used / replaced a moment ago.
      await otpVerifications.updateOne(
        { _id: verification._id, used: false },
        { $set: { used: true } }
      );

      const latest = await otpVerifications.findOne(
        { _id: verification._id },
        { projection: { verifiedAt: 1 } }
      );

      if (latest?.verifiedAt) {
        return NextResponse.json({ error: "This OTP has already been used. Please request a new one." }, { status: 400 });
      }

      return NextResponse.json({ error: "Too many incorrect attempts. Please request a new OTP." }, { status: 429 });
    }

    const attemptsUsed = Number(reserved.attempts || 0);

    if (!hashesMatch(reserved.otpHash, hashOtp(email, otp))) {
      const remaining = Math.max(0, maxAttempts - attemptsUsed);

      if (remaining === 0) {
        await otpVerifications.updateOne(
          { _id: verification._id, used: false },
          { $set: { used: true } }
        );
      }

      return NextResponse.json(
        { error: remaining > 0 ? `Incorrect OTP. ${remaining} attempt${remaining === 1 ? "" : "s"} remaining.` : "Incorrect OTP. Please request a new code." },
        { status: 400 }
      );
    }

    // Correct code: use it up in one step, so it signs in exactly once
    // even if the same correct code is sent twice at the same moment.
    const consumed = await otpVerifications.updateOne(
      { _id: verification._id, used: false },
      { $set: { used: true, verifiedAt: new Date() } }
    );

    if (consumed.modifiedCount !== 1) {
      return NextResponse.json({ error: "OTP is invalid or has expired. Please request a new one." }, { status: 400 });
    }

    const now = new Date().toISOString();
    let user = await db.collection("users").findOne({ email });

    if (purpose === "signup" && !user) {
      // New account. The mobile number must not belong to another account
      // (checked only now, after the email is proven, so the sign-up form
      // can't be used to look up whose number is registered).
      const newMobile = normalizeMobile(verification.mobile || mobile || body?.mobile);
      const mobileTaken = await db.collection("users").findOne({ mobile: newMobile });
      if (mobileTaken) {
        return NextResponse.json(
          {
            error:
              "This mobile number is already linked to another MANGOSTA account. Request a new code with a different number, or sign in with that account's email.",
          },
          { status: 409 }
        );
      }

      const result = await db.collection("users").insertOne({
        id: `usr-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        email,
        firstName: String(verification.firstName || body?.firstName || "").trim(),
        lastName: String(verification.lastName || body?.lastName || "").trim(),
        mobile: newMobile,
        emailVerified: true,
        createdAt: now,
        lastLoginAt: now,
      });

      user = await db.collection("users").findOne({ _id: result.insertedId });
    } else {
      // Sign in - or "sign up" with an email that already has an account:
      // the code proved they own the email, so they are simply signed in.
      if (!user) {
        return NextResponse.json(
          { error: "OTP is invalid or has expired. Please request a new one." },
          { status: 400 }
        );
      }

      await db.collection("users").updateOne(
        { _id: user._id },
        { $set: { emailVerified: true, lastLoginAt: now } }
      );

      user = await db.collection("users").findOne({ _id: user._id });
    }

    if (!user?.id) {
      return NextResponse.json({ error: "Unable to create the login session." }, { status: 500 });
    }

    await createSession(String(user.id));

    return NextResponse.json({
      success: true,
      user: {
        id: String(user.id),
        email: String(user.email),
        firstName: String(user.firstName || ""),
        lastName: String(user.lastName || ""),
        mobile: String((user as { mobile?: unknown }).mobile || ""),
        emailVerified: Boolean(user.emailVerified),
        createdAt: String(user.createdAt || now),
        lastLoginAt: now,
      },
    });
  } catch (error) {
    console.error("POST /api/auth/verify-otp failed:", error);
    return NextResponse.json(
      { error: "Unable to verify the code right now. Please try again in a moment." },
      { status: 500 }
    );
  }
}
