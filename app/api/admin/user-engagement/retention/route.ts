import { NextResponse } from "next/server";

import { isAuthenticated } from "@/app/lib/adminAuth";
import {
  LOYAL_MIN_ORDERS,
  addDaysToKey,
  getAnalyticsDb,
  getAnalyticsPeriod,
  indiaDateKey,
  isInPeriod,
  loadDirectoryForOrders,
  loadEventBoundsByUser,
  loadEvents,
  loadOrders,
  loadUsers,
  percent,
  publicPeriod,
  summarizeOrdersByCustomer,
  userKey,
} from "@/app/lib/userAnalytics";

export const dynamic = "force-dynamic";

const RETENTION_DAYS = [1, 7, 14, 30] as const;
const COHORT_DAYS = [7, 14, 30] as const;

/**
 * GET /api/admin/user-engagement/retention?range=30d
 *
 * Cohort  = the India-time day of a customer account's first-ever recorded
 *           activity (tracked event or order). The range picks which
 *           cohorts are shown.
 * Day N   = returned within N days: active again on any day from day 1 to
 *           day N after the cohort day. A cohort is only measured once its
 *           whole N-day window has passed.
 */
export async function GET(request: Request) {
  try {
    if (!(await isAuthenticated())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const period = getAnalyticsPeriod(
      new URL(request.url).searchParams.get("range")
    );
    const db = await getAnalyticsDb();

    const [users, eventBounds, orders] = await Promise.all([
      loadUsers(db),
      loadEventBoundsByUser(db),
      loadOrders(db),
    ]);

    const directory = await loadDirectoryForOrders(db, orders, users);
    const orderSummaries = summarizeOrdersByCustomer(orders, directory);

    /* Cohort membership: first-ever activity inside the selected range. */
    const cohortOf = new Map<string, string>();
    const repeatBuyers = new Set<string>();

    for (const user of users) {
      const firstEvent = eventBounds.get(user.id)?.firstAt ?? null;
      const summary = orderSummaries.get(userKey(user.id));
      const firstOrder = summary?.firstAnyOrderAt ?? null;

      const firstActivity =
        firstEvent && firstOrder
          ? firstEvent < firstOrder
            ? firstEvent
            : firstOrder
          : firstEvent ?? firstOrder;

      if (!firstActivity || !isInPeriod(firstActivity, period)) continue;

      cohortOf.set(user.id, indiaDateKey(firstActivity));
      if ((summary?.orders ?? 0) >= LOYAL_MIN_ORDERS) repeatBuyers.add(user.id);
    }

    /* Every active India day of the cohort customers since the range start. */
    const cohortIds = Array.from(cohortOf.keys());
    const activityDays = new Map<string, Set<string>>(
      cohortIds.map((id) => [id, new Set<string>()])
    );

    const events = cohortIds.length
      ? await loadEvents(
          db,
          { userId: { $in: cohortIds }, createdAt: { $gte: period.start } },
          { userId: 1, createdAt: 1 }
        )
      : [];

    for (const event of events) {
      activityDays.get(event.userId)?.add(indiaDateKey(event.createdAt));
    }

    for (const order of orders) {
      const owner = directory.ownerOf(order).userId;
      if (owner && activityDays.has(owner)) {
        activityDays.get(owner)!.add(indiaDateKey(order.createdAt));
      }
    }

    const todayKey = period.todayKey;

    const returnedWithin = (userId: string, days: number): boolean => {
      const cohortKey = cohortOf.get(userId)!;
      const lastKey = addDaysToKey(cohortKey, days);
      for (const key of activityDays.get(userId) ?? []) {
        if (key > cohortKey && key <= lastKey) return true;
      }
      return false;
    };

    /** The N-day window has fully passed (day N is before today). */
    const windowComplete = (cohortKey: string, days: number) =>
      addDaysToKey(cohortKey, days) < todayKey;

    const retention = RETENTION_DAYS.map((day) => {
      let eligible = 0;
      let retained = 0;

      for (const [userId, cohortKey] of cohortOf) {
        if (!windowComplete(cohortKey, day)) continue;
        eligible += 1;
        if (returnedWithin(userId, day)) retained += 1;
      }

      return { day, eligible, retained, rate: percent(retained, eligible) };
    });

    let returnedCustomers = 0;
    for (const [userId, cohortKey] of cohortOf) {
      const days = activityDays.get(userId) ?? new Set<string>();
      if ([...days].some((key) => key > cohortKey)) returnedCustomers += 1;
    }

    const cohortGroups = new Map<string, string[]>();
    for (const [userId, cohortKey] of cohortOf) {
      const group = cohortGroups.get(cohortKey) ?? [];
      group.push(userId);
      cohortGroups.set(cohortKey, group);
    }

    const cohorts = Array.from(cohortGroups.entries())
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([date, members]) => {
        const rates: Record<string, number | null> = {};
        for (const day of COHORT_DAYS) {
          rates[`day${day}`] = windowComplete(date, day)
            ? percent(
                members.filter((userId) => returnedWithin(userId, day)).length,
                members.length
              )
            : null;
        }

        return {
          date,
          customers: members.length,
          day7: rates.day7,
          day14: rates.day14,
          day30: rates.day30,
        };
      });

    const totalCustomers = cohortOf.size;

    return NextResponse.json({
      period: publicPeriod(period),
      summary: {
        totalCustomers,
        returnedCustomers,
        notReturnedCustomers: totalCustomers - returnedCustomers,
        returnRate: percent(returnedCustomers, totalCustomers),
        repeatBuyers: repeatBuyers.size,
        repeatBuyerRate: percent(repeatBuyers.size, totalCustomers),
      },
      retention,
      cohorts,
      definitions: {
        cohort:
          "Customer accounts whose first-ever recorded activity (tracked event or order) falls in the selected period, grouped by that day (India time).",
        returned:
          "Active again on any later day after their first-activity day (up to today).",
        dayN:
          "Returned within N days: active on any day from day 1 to day N after the first-activity day. Measured only once the full N-day window has passed.",
        repeatBuyers: "Cohort customers with 2 or more lifetime valid orders.",
      },
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[ADMIN USER ENGAGEMENT RETENTION]", error);
    return NextResponse.json(
      { error: "Unable to load retention analytics." },
      { status: 500 }
    );
  }
}
