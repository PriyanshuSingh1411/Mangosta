import { NextRequest, NextResponse } from "next/server";
import { destroyCurrentSession, getCurrentUser } from "@/app/lib/auth/session";
import {
  accountDeletionBlocker,
  AccountDeletionError,
  deleteAccountWithCode,
} from "@/app/lib/accountDeletion";

export const dynamic = "force-dynamic";

/** GET /api/account/delete → { canDelete, reason? } (shown before starting). */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });

  try {
    const reason = await accountDeletionBlocker(user);
    return NextResponse.json(reason ? { canDelete: false, reason } : { canDelete: true });
  } catch (error) {
    console.error("GET /api/account/delete failed:", error);
    return NextResponse.json({ error: "Couldn't check your account right now." }, { status: 500 });
  }
}

/**
 * POST /api/account/delete { code } — deletes the signed-in account after
 * the emailed code is confirmed (see app/lib/accountDeletion.ts).
 */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });

  const body = await req.json().catch(() => null);

  try {
    await deleteAccountWithCode(user, String(body?.code ?? ""));
  } catch (error) {
    if (error instanceof AccountDeletionError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("POST /api/account/delete failed:", error);
    return NextResponse.json(
      { error: "Couldn't delete your account right now. Please try again in a moment." },
      { status: 500 }
    );
  }

  // The sessions are already gone; this clears the cookie in this browser.
  await destroyCurrentSession().catch(() => undefined);
  return NextResponse.json({ ok: true });
}
