import { NextRequest, NextResponse } from "next/server";
import clientPromise from "@/app/lib/mongodb";
import {
  hashOtp,
  normalizeEmail,
  normalizeMobile,
  isValidMobile,
  OTP_MAX_ATTEMPTS,
  type OtpPurpose,
} from "@/app/lib/auth/otp";
import { createSession } from "@/app/lib/auth/session";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const email = normalizeEmail(body?.email);
    const otp = String(body?.otp ?? "").trim();
    const purpose: OtpPurpose = body?.purpose === "signup" ? "signup" : "signin";
    const mobile = normalizeMobile(body?.mobile);

    if (!email || !email.includes("@")) {
      return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
    }

    if (purpose === "signup" && !isValidMobile(mobile)) {
      return NextResponse.json({ error: "Enter a valid 10-digit Indian mobile number." }, { status: 400 });
    }

    if (!/^\d{6}$/.test(otp)) {
      return NextResponse.json({ error: "Enter the 6-digit OTP." }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db("mangosta");

    const verification = await db.collection("otpVerifications").findOne(
      { email, purpose, used: false },
      { sort: { createdAt: -1 } }
    );

    if (!verification) {
      return NextResponse.json({ error: "OTP is invalid or has expired. Please request a new one." }, { status: 400 });
    }

    if (new Date(verification.expiresAt).getTime() <= Date.now()) {
      await db.collection("otpVerifications").updateOne(
        { _id: verification._id },
        { $set: { used: true } }
      );
      return NextResponse.json({ error: "OTP has expired. Please request a new one." }, { status: 400 });
    }

    const attempts = Number(verification.attempts || 0);

    if (attempts >= Number(verification.maxAttempts || OTP_MAX_ATTEMPTS)) {
      await db.collection("otpVerifications").updateOne(
        { _id: verification._id },
        { $set: { used: true } }
      );
      return NextResponse.json({ error: "Too many incorrect attempts. Please request a new OTP." }, { status: 429 });
    }

    const expectedHash = hashOtp(email, otp);

    if (verification.otpHash !== expectedHash) {
      await db.collection("otpVerifications").updateOne(
        { _id: verification._id },
        { $inc: { attempts: 1 } }
      );

      const remaining = Math.max(
        0,
        Number(verification.maxAttempts || OTP_MAX_ATTEMPTS) - attempts - 1
      );

      return NextResponse.json(
        { error: remaining > 0 ? `Incorrect OTP. ${remaining} attempt${remaining === 1 ? "" : "s"} remaining.` : "Incorrect OTP. Please request a new code." },
        { status: 400 }
      );
    }

    await db.collection("otpVerifications").updateOne(
      { _id: verification._id },
      { $set: { used: true, verifiedAt: new Date() } }
    );

    const now = new Date().toISOString();
    let user = await db.collection("users").findOne({ email });

    if (purpose === "signup") {
      if (user) {
        return NextResponse.json(
          { error: "An account already exists with this email. Please sign in instead." },
          { status: 409 }
        );
      }

      const result = await db.collection("users").insertOne({
        id: `usr-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        email,
        firstName: String(verification.firstName || body?.firstName || "").trim(),
        lastName: String(verification.lastName || body?.lastName || "").trim(),
        mobile: normalizeMobile(verification.mobile || mobile || body?.mobile),
        emailVerified: true,
        createdAt: now,
        lastLoginAt: now,
      });

      user = await db.collection("users").findOne({ _id: result.insertedId });
    } else {
      if (!user) {
        return NextResponse.json(
          { error: "No account was found with this email. Please sign up first." },
          { status: 404 }
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
      { error: error instanceof Error ? error.message : "Unable to verify OTP." },
      { status: 500 }
    );
  }
}
