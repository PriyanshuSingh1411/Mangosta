import { NextResponse } from "next/server";
import { isAuthenticated } from "@/app/lib/adminAuth";
import { getBagReminderStats, runBagReminders } from "@/app/lib/bagReminders";
import { countWaitingAlerts } from "@/app/lib/stockAlerts";
import { isEmailConfigured } from "@/app/lib/auth/mail";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** GET → numbers shown on Admin → Reminders. */
export async function GET() {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [bags, waitingAlerts] = await Promise.all([getBagReminderStats(), countWaitingAlerts()]);

  return NextResponse.json({
    emailConfigured: isEmailConfigured(),
    cronConfigured: Boolean(process.env.CRON_SECRET),
    bagsWaiting: bags.waiting,
    lastRun: bags.lastRun ? { at: bags.lastRun.at, result: bags.lastRun.result } : null,
    waitingAlerts,
  });
}

/** POST → "Send reminders now". */
export async function POST() {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json(await runBagReminders());
}
