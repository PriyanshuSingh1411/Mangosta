import { NextRequest, NextResponse } from "next/server";
import clientPromise from "@/app/lib/mongodb";
import { getCurrentUser } from "@/app/lib/auth/session";
import { clearMarketingOptOut, unsubscribeFromMarketing } from "@/app/lib/emailPreferences";
import { normalizeMobile, isValidMobile } from "@/app/lib/auth/otp";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  const db = (await clientPromise).db("mangosta");
  const record = await db
    .collection("users")
    .findOne(
      { id: user.id },
      {
        projection: {
          _id: 0,
          firstName: 1,
          lastName: 1,
          email: 1,
          mobile: 1,
          dateOfBirth: 1,
          gender: 1,
          preferences: 1,
        },
      },
    );
  return NextResponse.json({
    profile: {
      ...(record ?? {}),
      email: record?.email ?? user.email,
      firstName: record?.firstName ?? user.firstName,
      lastName: record?.lastName ?? user.lastName,
      mobile: record?.mobile ?? user.mobile,
    },
  });
}

export async function PATCH(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const firstName = String(body?.firstName ?? "").trim();
  const lastName = String(body?.lastName ?? "").trim();
  if (!firstName || !lastName) {
    return NextResponse.json({ error: "First name and last name are required." }, { status: 400 });
  }
  const mobileInput = String(body?.mobile ?? "").trim();
  const mobile = normalizeMobile(mobileInput);
  if (!isValidMobile(mobile)) {
    return NextResponse.json({ error: "Enter a valid 10-digit Indian mobile number." }, { status: 400 });
  }

  // "New drops & editorial updates" (marketing emails, incl. bag reminders).
  // Order, delivery and sign-in emails are always sent, so there is no
  // setting for them.
  const marketingEmails = Boolean(body?.preferences?.marketingEmails);
  // The value the page loaded. When the customer didn't touch the box in
  // that page, it isn't changed - so a page left open from before an
  // email "Unsubscribe" can't silently subscribe them again on save.
  const loadedValue = body?.preferences?.marketingEmailsWas;
  const boxChanged = typeof loadedValue === "boolean" ? loadedValue !== marketingEmails : true;

  const db = (await clientPromise).db("mangosta");
  const users = db.collection("users");
  const duplicateMobile = await users.findOne({ mobile, id: { $ne: user.id } });
  if (duplicateMobile) {
    return NextResponse.json({ error: "This mobile number is already linked to another account." }, { status: 409 });
  }
  const before = await users.findOne({ id: user.id }, { projection: { _id: 0, preferences: 1 } });
  const wasOptedIn = before?.preferences?.marketingEmails === true;

  await users.updateOne(
    { id: user.id },
    {
      $set: {
        firstName,
        lastName,
        mobile,
        dateOfBirth: String(body?.dateOfBirth ?? "").trim(),
        gender: String(body?.gender ?? "").trim(),
        ...(boxChanged ? { "preferences.marketingEmails": marketingEmails } : {}),
        updatedAt: new Date().toISOString(),
      },
      $unset: { profilePhoto: "" },
    },
  );

  // Only an actual change acts on the other marketing records, so saving a
  // name never unsubscribes someone from the newsletter they joined.
  if (boxChanged && marketingEmails && !wasOptedIn) {
    await clearMarketingOptOut(user.email);
  } else if (boxChanged && !marketingEmails && wasOptedIn) {
    await unsubscribeFromMarketing(user.email, "account");
  }

  const updated = await users.findOne(
    { id: user.id },
    {
      projection: {
        _id: 0,
        firstName: 1,
        lastName: 1,
        email: 1,
        mobile: 1,
        dateOfBirth: 1,
        gender: 1,
        preferences: 1,
      },
    },
  );
  return NextResponse.json({ profile: updated });
}
