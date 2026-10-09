import "server-only";

import { randomBytes, timingSafeEqual } from "crypto";
import clientPromise from "@/app/lib/mongodb";
import type { AuthUser } from "@/app/lib/auth/session";
import {
  generateOtp,
  hashOtp,
  OTP_DAILY_WINDOW_MS,
  OTP_MAX_ATTEMPTS,
  OTP_RATE_WINDOW_MS,
  OTP_RESEND_COOLDOWN_MS,
  OTP_SEND_DAILY_LIMIT_PER_EMAIL,
  OTP_SEND_LIMIT_PER_EMAIL,
  OTP_TTL_MS,
} from "@/app/lib/auth/otp";
import { sendAccountDeletedEmail, sendEmailOtp } from "@/app/lib/auth/mail";
import { consumeRateLimits, describeWait } from "@/app/lib/rateLimit";
import type { ClientSession } from "mongodb";
import {
  accountLockId,
  countOpenOrdersForCustomer,
  OrderInProgressError,
  runExclusive,
  unlinkOrdersFromAccount,
} from "@/app/lib/dataStore";

// Customers can delete their own account from the Account page.
//
// 1. They ask for a 6-digit code (emailed to the account email).
// 2. They enter it; the account is then deleted at once, under the same
//    account lock as placing orders and return requests (runExclusive).
// Not possible while an order is still on its way (anything not delivered
// or cancelled) or a return / exchange is still open, so those can be
// finished first.
//
// What deleting does (one place, so it is easy to check):
//   deleted      the login (users), every signed-in session, saved
//                addresses, size profile, saved bag, wishlist and its share
//                links, back-in-stock alerts, newsletter subscription,
//                pending codes, support tickets and "helpful" votes
//   kept but     orders and return / exchange requests: sales and tax
//   unlinked     records the store must keep; they no longer belong to any
//                login
//   anonymised   reviews (shown as "Verified buyer") and product questions
//                (shown as "Customer"); shop statistics lose the user id
//                and the order id of purchases
//   kept         an email opt-out (if any), so a deleted customer is
//                never sent marketing by mistake

const DB_NAME = "mangosta";
const PURPOSE = "delete-account";

/** Shown instead of the name on reviews of deleted accounts. */
export const DELETED_REVIEW_AUTHOR = "Verified buyer";
const DELETED_QUESTION_AUTHOR = "Customer";

export class AccountDeletionError extends Error {
  constructor(
    message: string,
    readonly status = 400
  ) {
    super(message);
    this.name = "AccountDeletionError";
  }
}

async function db() {
  return (await clientPromise).db(DB_NAME);
}

function hashesMatch(stored: unknown, expected: string): boolean {
  if (typeof stored !== "string" || stored.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(stored), Buffer.from(expected));
}

/** Why the account can't be deleted yet, or null when it can. */
export async function accountDeletionBlocker(
  user: AuthUser,
  session?: ClientSession
): Promise<string | null> {
  const email = user.email.trim().toLowerCase();

  if ((await countOpenOrdersForCustomer({ userId: user.id, email }, session)) > 0) {
    return "You have an order that's still on its way. You can delete your account once it has been delivered or cancelled.";
  }

  const database = await db();
  const ownOrderIds = (
    await database
      .collection("orders")
      .find(
        { $or: [{ userId: user.id }, { "customer.email": email }] },
        { projection: { _id: 1 }, session }
      )
      .toArray()
  ).map((order) => String(order._id));

  const openReturns = await database.collection("returnRequests").countDocuments(
    {
      status: { $in: ["requested", "approved", "received"] },
      $or: [{ customerEmail: email }, { orderId: { $in: ownOrderIds } }],
    },
    { session }
  );

  if (openReturns > 0) {
    return "You have a return or exchange that's still open. You can delete your account once it's finished.";
  }

  return null;
}

/** Step 1: email a 6-digit code to the account email. */
export async function sendAccountDeletionCode(user: AuthUser): Promise<void> {
  const email = user.email.trim().toLowerCase();

  const blocker = await accountDeletionBlocker(user);
  if (blocker) throw new AccountDeletionError(blocker, 409);

  const codes = (await db()).collection("otpVerifications");

  const latest = await codes.findOne(
    { email, purpose: PURPOSE, used: false },
    { sort: { createdAt: -1 } }
  );
  if (latest?.createdAt) {
    const age = Date.now() - new Date(latest.createdAt).getTime();
    if (age < OTP_RESEND_COOLDOWN_MS) {
      const wait = Math.ceil((OTP_RESEND_COOLDOWN_MS - age) / 1000);
      throw new AccountDeletionError(`Please wait ${wait} seconds before asking for another code.`, 429);
    }
  }

  const rate = await consumeRateLimits([
    { key: `delete-code:email:${email}`, limit: OTP_SEND_LIMIT_PER_EMAIL, windowMs: OTP_RATE_WINDOW_MS },
    { key: `delete-code:email-day:${email}`, limit: OTP_SEND_DAILY_LIMIT_PER_EMAIL, windowMs: OTP_DAILY_WINDOW_MS },
  ]);
  if (!rate.allowed) {
    throw new AccountDeletionError(
      `Too many codes requested. Please try again in ${describeWait(rate.retryAfterSeconds)}.`,
      429
    );
  }

  const otp = generateOtp();
  const now = new Date();

  await codes.updateMany({ email, purpose: PURPOSE, used: false }, { $set: { used: true } });
  await codes.insertOne({
    email,
    purpose: PURPOSE,
    userId: user.id,
    otpHash: hashOtp(email, otp),
    createdAt: now,
    expiresAt: new Date(now.getTime() + OTP_TTL_MS),
    attempts: 0,
    maxAttempts: OTP_MAX_ATTEMPTS,
    used: false,
  });

  await sendEmailOtp(email, otp, "delete-account");
}

/**
 * Step 2: checks the code (5 tries per code, counted atomically like the
 * sign-in code) and deletes the account.
 */
export async function deleteAccountWithCode(user: AuthUser, code: string): Promise<void> {
  const email = user.email.trim().toLowerCase();
  const otp = String(code ?? "").trim();

  if (!/^\d{6}$/.test(otp)) {
    throw new AccountDeletionError("Enter the 6-digit code from the email.");
  }

  const codes = (await db()).collection("otpVerifications");
  const verification = await codes.findOne(
    { email, purpose: PURPOSE, used: false },
    { sort: { createdAt: -1 } }
  );

  if (!verification || new Date(verification.expiresAt).getTime() <= Date.now()) {
    throw new AccountDeletionError("This code has expired. Please ask for a new one.");
  }

  const maxAttempts = Number(verification.maxAttempts || OTP_MAX_ATTEMPTS);
  const reserved = await codes.findOneAndUpdate(
    {
      _id: verification._id,
      used: false,
      $or: [{ attempts: { $lt: maxAttempts } }, { attempts: { $exists: false } }],
    },
    { $inc: { attempts: 1 } },
    { returnDocument: "after" }
  );

  if (!reserved) {
    await codes.updateOne({ _id: verification._id, used: false }, { $set: { used: true } });
    throw new AccountDeletionError("Too many incorrect tries. Please ask for a new code.", 429);
  }

  if (!hashesMatch(reserved.otpHash, hashOtp(email, otp))) {
    const remaining = Math.max(0, maxAttempts - Number(reserved.attempts || 0));
    if (remaining === 0) {
      await codes.updateOne({ _id: verification._id, used: false }, { $set: { used: true } });
    }
    throw new AccountDeletionError(
      remaining > 0
        ? `Incorrect code. ${remaining} ${remaining === 1 ? "try" : "tries"} left.`
        : "Incorrect code. Please ask for a new one."
    );
  }

  // An order could have been placed since the code was sent (checked
  // before the code is used up, so it stays valid once that is finished).
  const blocker = await accountDeletionBlocker(user);
  if (blocker) throw new AccountDeletionError(blocker, 409);

  const consumed = await codes.updateOne(
    { _id: verification._id, used: false },
    { $set: { used: true, verifiedAt: new Date() } }
  );
  if (consumed.modifiedCount !== 1) {
    throw new AccountDeletionError("This code has already been used. Please ask for a new one.");
  }

  // Under the account lock that placing orders and creating return
  // requests also take: an order or return can't slip in between the last
  // check and the deletion, and none can be created afterwards (they check
  // the account still exists under the same lock). With transactions
  // (Atlas) the whole deletion is also all-or-nothing.
  try {
    await runExclusive(accountLockId(user.id, email), (session) => eraseAccount(user, session));
  } catch (error) {
    if (error instanceof OrderInProgressError) {
      throw new AccountDeletionError(
        "Something else on your account is being saved right now. Please try again in a moment.",
        409
      );
    }
    throw error;
  }

  try {
    await sendAccountDeletedEmail(email);
  } catch (error) {
    console.error("[account deletion] Could not send the confirmation email:", error);
  }
}

/**
 * Deletes / unlinks / anonymises everything listed at the top of this file.
 * Runs under the account lock (and inside one transaction when the
 * database supports them), so every step uses `session`, one at a time.
 */
async function eraseAccount(user: AuthUser, session?: ClientSession): Promise<void> {
  const database = await db();
  const userId = user.id;
  const email = user.email.trim().toLowerCase();
  // A value no real account id can have, for records that must keep a userId.
  const formerId = `deleted-${randomBytes(6).toString("hex")}`;
  const options = { session };

  // Last check, under the lock: nothing may still be open.
  const blocker = await accountDeletionBlocker(user, session);
  if (blocker) throw new AccountDeletionError(blocker, 409);

  // Kept but unlinked / anonymised.
  await unlinkOrdersFromAccount(userId, session);
  await database
    .collection("reviews")
    .updateMany({ userId }, { $set: { userId: formerId, authorName: DELETED_REVIEW_AUTHOR } }, options);
  await database
    .collection("productQuestions")
    .updateMany({ userId }, { $set: { userId: formerId, authorName: DELETED_QUESTION_AUTHOR } }, options);
  // Shop statistics: no user id, and purchases no longer point at an order
  // (which still carries the name and email), so the events can't be
  // traced back to the person.
  await database
    .collection("userEvents")
    .updateMany({ userId }, { $unset: { userId: "", "metadata.orderId": "" } }, options);

  // Deleted.
  await database.collection("addresses").deleteMany({ userId }, options);
  await database.collection("sizeProfiles").deleteMany({ userId }, options);
  await database.collection("carts").deleteMany({ _id: userId as never }, options);
  await database.collection("wishlists").deleteMany({ _id: userId as never }, options);
  await database.collection("wishlistShares").deleteMany({ userId }, options);
  await database.collection("reviewVotes").deleteMany({ userId }, options);
  await database.collection("supportTickets").deleteMany({ userId }, options);
  await database.collection("stockAlerts").deleteMany({ email }, options);
  await database.collection("newsletterSubscribers").deleteMany({ email }, options);
  await database.collection("otpVerifications").deleteMany({ email }, options);

  // Every session (signs out all devices) and the login itself.
  await database.collection("sessions").deleteMany({ userId }, options);
  await database.collection("users").deleteOne({ id: userId }, options);
}
