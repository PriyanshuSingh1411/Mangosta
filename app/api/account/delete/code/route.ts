import { NextResponse } from "next/server";
import { getCurrentUser } from "@/app/lib/auth/session";
import { AccountDeletionError, sendAccountDeletionCode } from "@/app/lib/accountDeletion";

export const dynamic = "force-dynamic";

/** POST /api/account/delete/code — emails the code that confirms deleting the account. */
export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });

  try {
    await sendAccountDeletionCode(user);
    return NextResponse.json({ ok: true, email: user.email });
  } catch (error) {
    if (error instanceof AccountDeletionError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("POST /api/account/delete/code failed:", error);
    return NextResponse.json(
      { error: "Couldn't send the code right now. Please try again in a moment." },
      { status: 500 }
    );
  }
}
