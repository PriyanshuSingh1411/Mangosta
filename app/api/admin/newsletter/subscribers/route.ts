import { NextResponse } from "next/server";
import { isAuthenticated } from "@/app/lib/adminAuth";
import { getSubscribers } from "@/app/lib/newsletterStore";

export const dynamic = "force-dynamic";

export async function GET() {
  // Subscriber emails are private: admin only, like every other admin route.
  if (!(await isAuthenticated())) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const subscribers = await getSubscribers();

    return NextResponse.json({
      success: true,
      subscribers,
    });
  } catch (error) {
    console.error("[admin newsletter subscribers]", error);

    return NextResponse.json(
      {
        success: false,
        error: "Failed to load subscribers.",
      },
      { status: 500 }
    );
  }
}
