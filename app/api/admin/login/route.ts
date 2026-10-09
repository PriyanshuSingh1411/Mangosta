import { NextRequest, NextResponse } from "next/server";

import {
  adminAuthConfigured,
  verifyPassword,
  setSessionCookie,
} from "@/app/lib/adminAuth";
import {
  describeAdminWait,
  failAdminLoginAttempt,
  startAdminLoginAttempt,
  succeedAdminLoginAttempt,
  type AdminLoginBlock,
} from "@/app/lib/adminLoginGuard";
import { getClientIp } from "@/app/lib/rateLimit";

function blocked(block: AdminLoginBlock) {
  return NextResponse.json(
    {
      error:
        block.scope === "everywhere"
          ? `Admin login is paused after too many wrong passwords. Try again in ${describeAdminWait(block.retryAfterSeconds)}.`
          : `Too many wrong passwords. Try again in ${describeAdminWait(block.retryAfterSeconds)}.`,
    },
    {
      status: 429,
      headers: { "Retry-After": String(block.retryAfterSeconds) },
    }
  );
}

export async function POST(req: NextRequest) {
  // Live site without ADMIN_PASSWORD + ADMIN_SESSION_SECRET: refuse, instead
  // of falling back to the built-in password/secret that are public in code.
  if (!adminAuthConfigured()) {
    return NextResponse.json(
      {
        error:
          "Admin login is turned off: ADMIN_PASSWORD and ADMIN_SESSION_SECRET must be set in the server's environment variables.",
      },
      { status: 503 }
    );
  }

  const { password } = await req.json().catch(() => ({ password: "" }));

  if (typeof password !== "string" || password.length === 0) {
    return NextResponse.json(
      { error: "Invalid password." },
      { status: 401 }
    );
  }

  // Counted before the password is checked (see adminLoginGuard.ts).
  const attempt = await startAdminLoginAttempt(getClientIp(req));

  if (!attempt.allowed) {
    return blocked(attempt.block);
  }

  if (!verifyPassword(password)) {
    const block = await failAdminLoginAttempt(attempt);

    if (block) {
      return blocked(block);
    }

    return NextResponse.json(
      { error: "Invalid password." },
      { status: 401 }
    );
  }

  await succeedAdminLoginAttempt(attempt);
  await setSessionCookie();

  return NextResponse.json({ ok: true });
}
