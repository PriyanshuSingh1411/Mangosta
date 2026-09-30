import { cookies } from "next/headers";
import { randomBytes } from "crypto";
import clientPromise from "@/app/lib/mongodb";
import { hashSessionToken } from "./otp";

export const SESSION_COOKIE = "mangosta_session";
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  mobile: string;
  emailVerified: boolean;
  createdAt: string;
  lastLoginAt: string;
}

export async function createSession(userId: string) {
  const rawToken = randomBytes(32).toString("hex");
  const tokenHash = hashSessionToken(rawToken);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_TTL_MS);

  const client = await clientPromise;
  const db = client.db("mangosta");

  await db.collection("sessions").insertOne({
    tokenHash,
    userId,
    createdAt: now,
    expiresAt,
  });

  const cookieStore = await cookies();

  cookieStore.set(SESSION_COOKIE, rawToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;

  if (!token) {
    return null;
  }

  const tokenHash = hashSessionToken(token);
  const now = new Date();

  const client = await clientPromise;
  const db = client.db("mangosta");

  const session = await db.collection("sessions").findOne({
    tokenHash,
    expiresAt: { $gt: now },
  });

  if (!session) {
    cookieStore.delete(SESSION_COOKIE);
    return null;
  }

  const user = await db.collection<AuthUser>("users").findOne({
    id: session.userId,
  });

  if (!user) {
    await db.collection("sessions").deleteOne({ _id: session._id });
    cookieStore.delete(SESSION_COOKIE);
    return null;
  }

  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    mobile: String((user as { mobile?: unknown }).mobile || ""),
    emailVerified: Boolean(user.emailVerified),
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt,
  };
}

export async function destroyCurrentSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;

  if (token) {
    const tokenHash = hashSessionToken(token);
    const client = await clientPromise;
    const db = client.db("mangosta");

    await db.collection("sessions").deleteOne({ tokenHash });
  }

  cookieStore.delete(SESSION_COOKIE);
}
