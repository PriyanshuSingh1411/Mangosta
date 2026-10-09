import { NextResponse } from "next/server";
import {
  clearSessionCookie,
  endAllAdminSessions,
  isAuthenticated,
} from "@/app/lib/adminAuth";

/**
 * Logs out. A signed-in admin's logout ends EVERY admin session (all
 * devices, and any copied cookie). A request without a valid session only
 * clears its own cookie, so strangers can't log the admin out.
 */
export async function POST() {
  if (await isAuthenticated()) {
    await endAllAdminSessions();
  }

  await clearSessionCookie();
  return NextResponse.json({ ok: true });
}
