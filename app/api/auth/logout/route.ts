import { NextResponse } from "next/server";
import { destroyCurrentSession } from "@/app/lib/auth/session";

export async function POST() {
  try {
    await destroyCurrentSession();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("POST /api/auth/logout failed:", error);
    return NextResponse.json({ error: "Unable to log out." }, { status: 500 });
  }
}
