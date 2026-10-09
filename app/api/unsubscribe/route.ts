import { NextRequest, NextResponse } from "next/server";
import {
  isValidUnsubscribeToken,
  unsubscribeFromMarketing,
} from "@/app/lib/emailPreferences";

export const dynamic = "force-dynamic";

/**
 * POST /api/unsubscribe?e=<email>&t=<signature>
 *
 * Used by mail apps' own "Unsubscribe" button (one-click, RFC 8058: they
 * POST "List-Unsubscribe=One-Click" here) and by the /unsubscribe page.
 * Stops all marketing emails to that address.
 */
export async function POST(req: NextRequest) {
  try {
    const email = req.nextUrl.searchParams.get("e") ?? "";
    const token = req.nextUrl.searchParams.get("t") ?? "";

    if (!isValidUnsubscribeToken(email, token)) {
      return NextResponse.json(
        { error: "This unsubscribe link isn't valid. You can turn off emails from your account page." },
        { status: 400 }
      );
    }

    await unsubscribeFromMarketing(email, "link");
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("POST /api/unsubscribe failed:", error);
    return NextResponse.json(
      { error: "Couldn't unsubscribe right now. Please try again in a moment." },
      { status: 500 }
    );
  }
}

/** Opening the one-click address in a browser shows the confirm page. */
export async function GET(req: NextRequest) {
  const url = new URL("/unsubscribe", req.nextUrl.origin);
  url.search = req.nextUrl.search;
  return NextResponse.redirect(url);
}
