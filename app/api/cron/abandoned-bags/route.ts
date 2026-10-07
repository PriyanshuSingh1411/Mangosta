import { NextRequest, NextResponse } from "next/server";
import { runBagReminders } from "@/app/lib/bagReminders";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Called once a day by Vercel Cron (see vercel.json).
 * Vercel sends "Authorization: Bearer <CRON_SECRET>" — set CRON_SECRET in
 * the project's environment variables. Without it the route refuses to run.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const header = req.headers.get("authorization") ?? "";

  if (!secret || header !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await runBagReminders();
  return NextResponse.json(result);
}
