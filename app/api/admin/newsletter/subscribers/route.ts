import { NextResponse } from "next/server";
import { getSubscribers } from "@/app/lib/newsletterStore";

export const dynamic = "force-dynamic";

export async function GET() {
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