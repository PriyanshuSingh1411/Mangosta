"use client";

import { useCallback, useEffect, useState } from "react";
import type { EmailAutomationConfig } from "@/app/data/storeTypes";
import { adminButtonClass, adminInputClass, useStoreConfig } from "../useStoreConfig";

type Stats = {
  emailConfigured: boolean;
  cronConfigured: boolean;
  bagsWaiting: number;
  waitingAlerts: number;
  lastRun: {
    at: string;
    result: { checked: number; sent: number; skipped: number; failed: number; note: string };
  } | null;
};

export default function AdminRemindersPage() {
  const { value, update, save, loading, saving, error, saved } =
    useStoreConfig<EmailAutomationConfig>("emailAutomation");
  const [stats, setStats] = useState<Stats | null>(null);
  const [running, setRunning] = useState(false);
  const [runMessage, setRunMessage] = useState<string | null>(null);

  const loadStats = useCallback(() => {
    return fetch("/api/admin/reminders", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((data: Stats | null) => {
        if (data) setStats(data);
      })
      .catch(() => undefined); // stats are optional
  }, []);

  useEffect(() => {
    fetch("/api/admin/reminders", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((data: Stats | null) => {
        if (data) setStats(data);
      })
      .catch(() => undefined);
  }, []);

  const runNow = async () => {
    setRunning(true);
    setRunMessage(null);
    try {
      const response = await fetch("/api/admin/reminders", { method: "POST" });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || "Failed to run.");
      setRunMessage(data.note || `Sent ${data.sent} reminder(s).`);
      void loadStats();
    } catch (err) {
      setRunMessage(err instanceof Error ? err.message : "Failed to run.");
    } finally {
      setRunning(false);
    }
  };

  if (loading || !value) {
    return (
      <div>
        <p className="label-technical mb-2">MARKETING</p>
        <h1 className="type-heading text-bone">Reminders</h1>
        <p className="mt-8 text-sm text-stone">{error ?? "Loading…"}</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl">
      <p className="label-technical mb-2">MARKETING</p>
      <h1 className="mb-3 type-heading text-bone">Reminders</h1>
      <p className="mb-8 max-w-2xl text-sm leading-relaxed text-stone">
        Automatic emails: a reminder to signed-in customers who leave items in their bag (only
        customers who ticked &ldquo;New drops &amp; editorial updates&rdquo; on their account; every
        reminder has an unsubscribe link), and a &ldquo;back in stock&rdquo; email to customers who
        asked to be told about a sold-out size.
      </p>

      {stats && (
        <div className="mb-8 flex flex-col gap-3">
          {!stats.emailConfigured && (
            <p className="border border-mango/40 bg-mango/5 px-4 py-3 text-xs leading-relaxed text-mango">
              Email isn&apos;t set up on the server (SMTP_HOST, SMTP_USER, SMTP_PASSWORD), so no
              reminder or back-in-stock emails can be sent yet.
            </p>
          )}
          {!stats.cronConfigured && (
            <p className="border border-line-strong px-4 py-3 text-xs leading-relaxed text-stone">
              Daily automatic sending needs a <span className="font-mono text-bone">CRON_SECRET</span>{" "}
              environment variable on Vercel. Until then, use &ldquo;Send reminders now&rdquo;.
            </p>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="border border-line px-4 py-4">
              <p className="label-technical mb-2">Bags saved</p>
              <p className="font-display text-lg tracking-tight text-bone sm:text-xl">{stats.bagsWaiting}</p>
              <p className="mt-1 text-xs text-stone">not reminded yet</p>
            </div>
            <div className="border border-line px-4 py-4">
              <p className="label-technical mb-2">Restock requests</p>
              <p className="font-display text-lg tracking-tight text-bone sm:text-xl">{stats.waitingAlerts}</p>
              <p className="mt-1 text-xs text-stone">customers waiting</p>
            </div>
          </div>
          {stats.lastRun && (
            <p className="text-xs text-stone">
              Last reminder run: {new Date(stats.lastRun.at).toLocaleString()} — {stats.lastRun.result.note}
            </p>
          )}
        </div>
      )}

      <section className="mb-8 flex flex-col gap-4 border border-line-strong bg-charcoal/30 p-5">
        <p className="label-technical">ABANDONED BAG EMAIL</p>

        <label className="flex items-center gap-2 text-sm text-bone-dim">
          <input
            type="checkbox"
            checked={value.abandonedBagEnabled}
            onChange={(e) => update({ abandonedBagEnabled: e.target.checked })}
            className="h-4 w-4 accent-[color:var(--color-mango)]"
          />
          Send one reminder when a bag is left untouched
        </label>

        <label className="flex items-center gap-2 text-sm text-bone-dim">
          After at least
          <input
            type="number"
            min={24}
            max={168}
            value={value.abandonedBagDelayHours}
            onChange={(e) => update({ abandonedBagDelayHours: Number(e.target.value) })}
            className="w-20 border border-line-strong bg-transparent px-2 py-1.5 text-center font-mono text-sm text-bone focus:border-bone focus:outline-none"
          />
          hours (checked once a day, around 10:00 AM)
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs text-stone">Subject</span>
          <input value={value.abandonedBagSubject} onChange={(e) => update({ abandonedBagSubject: e.target.value })} className={adminInputClass} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs text-stone">Heading</span>
          <input value={value.abandonedBagHeading} onChange={(e) => update({ abandonedBagHeading: e.target.value })} className={adminInputClass} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs text-stone">Message</span>
          <textarea value={value.abandonedBagBody} onChange={(e) => update({ abandonedBagBody: e.target.value })} rows={3} className={adminInputClass} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs text-stone">Button text</span>
          <input value={value.abandonedBagButtonText} onChange={(e) => update({ abandonedBagButtonText: e.target.value })} className={adminInputClass} />
        </label>
        <p className="text-xs text-stone">The email lists up to 4 items from the bag with their photos and a button back to the bag.</p>

        <div className="flex flex-wrap items-center gap-3 border-t border-line pt-4">
          <button
            type="button"
            onClick={() => void runNow()}
            disabled={running}
            className="border border-line-strong px-5 py-3 text-xs tracking-[0.15em] text-bone transition-colors hover:border-bone disabled:opacity-50"
          >
            {running ? "SENDING…" : "SEND REMINDERS NOW"}
          </button>
          {runMessage && <span className="text-xs text-mango" aria-live="polite">{runMessage}</span>}
        </div>
      </section>

      <section className="mb-8 flex flex-col gap-4 border border-line-strong bg-charcoal/30 p-5">
        <p className="label-technical">BACK IN STOCK EMAIL</p>
        <label className="flex items-center gap-2 text-sm text-bone-dim">
          <input
            type="checkbox"
            checked={value.backInStockEnabled}
            onChange={(e) => update({ backInStockEnabled: e.target.checked })}
            className="h-4 w-4 accent-[color:var(--color-mango)]"
          />
          Email waiting customers when you add stock for their size
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs text-stone">Subject ({"{product}"} is replaced by the product name)</span>
          <input value={value.backInStockSubject} onChange={(e) => update({ backInStockSubject: e.target.value })} className={adminInputClass} />
        </label>
      </section>

      {error && <p role="alert" className="mb-4 text-sm text-mango">{error}</p>}

      <div className="flex items-center gap-4">
        <button type="button" onClick={() => void save()} disabled={saving} className={adminButtonClass}>
          {saving ? "SAVING…" : "SAVE REMINDER SETTINGS"}
        </button>
        {saved && <span className="text-xs text-mango">Saved.</span>}
      </div>
    </div>
  );
}
