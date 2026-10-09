import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import clientPromise from "@/app/lib/mongodb";
import { getCurrentUser } from "@/app/lib/auth/session";
import { generateOtp, hashOtp, normalizeEmail, isValidEmail } from "@/app/lib/auth/otp";
import { sendEmailOtp } from "@/app/lib/auth/mail";

function matchesHash(stored: unknown, expected: string) {
  if (typeof stored !== "string" || stored.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(stored), Buffer.from(expected));
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });

  const body = await req.json().catch(() => null);
  const action = body?.action === "verify" ? "verify" : body?.action === "send" ? "send" : null;
  const value = normalizeEmail(body?.value);
  if (!action) return NextResponse.json({ error: "Invalid verification request." }, { status: 400 });
  if (!isValidEmail(value)) return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });

  const db = (await clientPromise).db("mangosta");
  const users = db.collection("users");
  const current = await users.findOne({ id: user.id });
  if (!current) return NextResponse.json({ error: "Account not found." }, { status: 404 });

  if (value === normalizeEmail(current.email ?? user.email)) {
    return NextResponse.json({ error: "This email address is already on your account." }, { status: 400 });
  }
  const duplicate = await users.findOne({ email: value, id: { $ne: user.id } });
  if (duplicate) return NextResponse.json({ error: "This email address is already linked to another account." }, { status: 409 });

  const verifications = db.collection("contactVerifications");
  if (action === "send") {
    const recent = await verifications.findOne({ userId: user.id, channel: "email", value, used: false }, { sort: { createdAt: -1 } });
    if (recent?.createdAt && Date.now() - new Date(recent.createdAt).getTime() < 60_000) {
      return NextResponse.json({ error: "Please wait 60 seconds before requesting another OTP." }, { status: 429 });
    }
    await verifications.updateMany({ userId: user.id, channel: "email", used: false }, { $set: { used: true } });
    const otp = generateOtp();
    const now = new Date();
    await verifications.insertOne({
      userId: user.id,
      channel: "email",
      value,
      otpHash: hashOtp(`${user.id}:email:${value}`, otp),
      createdAt: now,
      expiresAt: new Date(now.getTime() + 10 * 60_000),
      attempts: 0,
      used: false,
    });
    try {
      await sendEmailOtp(value, otp, "contact-change");
    } catch {
      await verifications.updateMany({ userId: user.id, channel: "email", value, used: false }, { $set: { used: true } });
      return NextResponse.json({ error: "Could not send the email OTP. Check your SMTP configuration and try again." }, { status: 500 });
    }
    return NextResponse.json({ success: true, message: "Verification code sent to your email address." });
  }

  const record = await verifications.findOne({ userId: user.id, channel: "email", value, used: false }, { sort: { createdAt: -1 } });
  if (!record || new Date(record.expiresAt).getTime() <= Date.now()) {
    if (record) await verifications.updateOne({ _id: record._id }, { $set: { used: true } });
    return NextResponse.json({ error: "OTP has expired or was not requested. Please request a new code." }, { status: 400 });
  }
  if (Number(record.attempts || 0) >= 5) {
    await verifications.updateOne({ _id: record._id }, { $set: { used: true } });
    return NextResponse.json({ error: "Too many incorrect attempts. Request a new OTP." }, { status: 429 });
  }
  await verifications.updateOne({ _id: record._id }, { $inc: { attempts: 1 } });
  const submittedHash = hashOtp(`${user.id}:email:${value}`, String(body?.otp ?? "").trim());
  if (!matchesHash(record.otpHash, submittedHash)) {
    return NextResponse.json({ error: "Incorrect OTP. Please try again." }, { status: 400 });
  }

  const saved = await users.updateOne(
    { id: user.id, email: current.email },
    { $set: { email: value, emailVerified: true, updatedAt: new Date().toISOString() } },
  );
  if (saved.modifiedCount !== 1) {
    return NextResponse.json({ error: "Your account changed during verification. Please refresh and try again." }, { status: 409 });
  }
  await verifications.updateOne({ _id: record._id, used: false }, { $set: { used: true, verifiedAt: new Date() } });
  return NextResponse.json({ success: true, value, message: "Email address verified and updated successfully." });
}
