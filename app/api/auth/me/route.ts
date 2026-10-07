import { NextResponse } from "next/server";
import { getCurrentUser } from "@/app/lib/auth/session";

export async function GET() {
  try {
    const user = await getCurrentUser();

    return NextResponse.json(
      { user },
      {
        status: 200,
        headers: { "Cache-Control": "no-store, max-age=0" },
      }
    );
  } catch (error) {
    console.error("GET /api/auth/me failed:", error);
    return NextResponse.json({ user: null }, { status: 200 });
  }
}
