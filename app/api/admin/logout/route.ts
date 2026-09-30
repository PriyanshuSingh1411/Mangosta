import { NextResponse } from "next/server";
import { clearSessionCookie } from "@/app/lib/adminAuth";

export async function POST() {
  await clearSessionCookie();
  return NextResponse.json({ ok: true });
}
