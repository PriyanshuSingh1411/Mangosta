import { NextResponse } from "next/server";
import { getSettings } from "@/app/lib/dataStore";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const settings = await getSettings();

    return NextResponse.json(settings, {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    });
  } catch (error) {
    console.error("Public settings error:", error);

    return NextResponse.json(
      {
        error: "Failed to load settings",
      },
      {
        status: 500,
      }
    );
  }
}