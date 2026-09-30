import { NextRequest, NextResponse } from "next/server";
import { verifyPassword, setSessionCookie } from "@/app/lib/adminAuth";

export async function POST(req: NextRequest) {
  const { password } = await req.json().catch(() => ({ password: "" }));

  if (typeof password !== "string" || !verifyPassword(password)) {
    return NextResponse.json({ error: "Invalid password." }, { status: 401 });
  }

  await setSessionCookie();
  return NextResponse.json({ ok: true });
}
