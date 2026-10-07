import { NextRequest, NextResponse } from "next/server";
import clientPromise from "@/app/lib/mongodb";
import {
  generateOtp,
  hashOtp,
  normalizeEmail,
  normalizeMobile,
  isValidMobile,
  OTP_MAX_ATTEMPTS,
  OTP_RESEND_COOLDOWN_MS,
  OTP_TTL_MS,
  type OtpPurpose,
} from "@/app/lib/auth/otp";
import { sendEmailOtp } from "@/app/lib/auth/mail";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const email = normalizeEmail(body?.email);
    const purpose: OtpPurpose = body?.purpose === "signup" ? "signup" : "signin";
    const firstName = String(body?.firstName ?? "").trim();
    const lastName = String(body?.lastName ?? "").trim();
    const mobile = normalizeMobile(body?.mobile);

    if (!email || !email.includes("@")) {
      return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
    }

    if (purpose === "signup" && (!firstName || !lastName)) {
      return NextResponse.json({ error: "First name and last name are required for sign up." }, { status: 400 });
    }

    if (purpose === "signup" && !isValidMobile(mobile)) {
      return NextResponse.json({ error: "Enter a valid 10-digit Indian mobile number." }, { status: 400 });
    }

    const client = await clientPromise;
    const db = client.db("mangosta");

    await db.collection("users").createIndex({ email: 1 }, { unique: true });
    await db.collection("otpVerifications").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });

    const user = await db.collection("users").findOne({ email });

    if (purpose === "signup" && user) {
      return NextResponse.json({ error: "An account already exists with this email. Please sign in instead." }, { status: 409 });
    }

    if (purpose === "signup") {
      const mobileUser = await db.collection("users").findOne({ mobile });
      if (mobileUser) {
        return NextResponse.json({ error: "An account already exists with this mobile number. Please sign in instead." }, { status: 409 });
      }
    }

    if (purpose === "signin" && !user) {
      return NextResponse.json({ error: "No account was found with this email. Please sign up first." }, { status: 404 });
    }

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

    const otp = generateOtp();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + OTP_TTL_MS);

    await db.collection("otpVerifications").updateMany(
      { email, purpose, used: false },
      { $set: { used: true } }
    );

    await db.collection("otpVerifications").insertOne({
      email,
      purpose,
      otpHash: hashOtp(email, otp),
      firstName: purpose === "signup" ? firstName : "",
      lastName: purpose === "signup" ? lastName : "",
      mobile: purpose === "signup" ? mobile : "",
      createdAt: now,
      expiresAt,
      attempts: 0,
      maxAttempts: OTP_MAX_ATTEMPTS,
      used: false,
    });

    await sendEmailOtp(email, otp, purpose);

    return NextResponse.json({
      success: true,
      message: "Verification code sent to your email.",
    });
  } catch (error) {
    console.error("POST /api/auth/send-otp failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to send verification code." },
      { status: 500 }
    );
  }
}
