import { NextRequest, NextResponse } from "next/server";
import { confirmNewsletterFromLink } from "@/app/lib/newsletterConfirm";

export const dynamic = "force-dynamic";

/**
 * POST /api/newsletter/confirm?e=<email>&t=<signature>
 * The owner confirms (from the link sent to their inbox) that they want
 * MANGOSTA WORLD emails.
 */
export async function POST(req: NextRequest) {
  try {
    const ok = await confirmNewsletterFromLink(
      req.nextUrl.searchParams.get("e") ?? "",
      req.nextUrl.searchParams.get("t") ?? ""
    );

    if (!ok) {
      return NextResponse.json(
        { error: "This link isn't valid. You can join from the form at the bottom of any page." },
        { status: 400 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("POST /api/newsletter/confirm failed:", error);
    return NextResponse.json(
      { error: "Couldn't confirm right now. Please try again in a moment." },
      { status: 500 }
    );
  }
}
