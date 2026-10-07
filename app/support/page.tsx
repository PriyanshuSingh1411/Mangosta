"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Navigation from "@/app/components/Navigation";
import EngagementTracker from "@/app/components/EngagementTracker";
type SupportCategory = "order" | "delivery" | "return" | "product" | "size" | "other";
type SupportTicket = { id: string; userId: string; email: string; category: SupportCategory; subject: string; status: "open" | "in_progress" | "resolved"; messages: { id: string; sender: "customer" | "admin"; text: string; createdAt: string }[]; createdAt: string; updatedAt: string };

const SUPPORT_OPEN_METADATA = { source: "support_page" };

const categories: { value: SupportCategory; label: string }[] = [
  { value: "order", label: "Order issue" },
  { value: "delivery", label: "Delivery issue" },
  { value: "return", label: "Return / exchange" },
  { value: "product", label: "Product question" },
  { value: "size", label: "Size issue" },
  { value: "other", label: "Other" },
];

export default function SupportPage() {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [category, setCategory] = useState<SupportCategory>("order");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = () => fetch("/api/support/tickets", { cache: "no-store" }).then((r) => r.json()).then((d) => setTickets(d.tickets || [])).finally(() => setLoading(false));
  useEffect(() => { void load(); }, []);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true); setError("");
    const response = await fetch("/api/support/tickets", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ category, subject, message }) });
    const data = await response.json().catch(() => null);
    if (!response.ok) setError(data?.error || "Unable to create ticket.");
    else { setSubject(""); setMessage(""); void load(); }
    setSaving(false);
  };

  return (
    <>
      <EngagementTracker event="support_open" path="/support" metadata={SUPPORT_OPEN_METADATA} />
      <Navigation />
      <main id="main-content" className="min-h-screen bg-void px-5 pb-24 pt-32 sm:px-8 sm:pt-40">
        <div className="mx-auto max-w-5xl">
          <p className="label-technical mb-4">MANGOSTA / SUPPORT</p>
          <h1 className="font-display text-5xl tracking-tight text-bone sm:text-7xl">HELP & SUPPORT</h1>
          <p className="mt-5 max-w-2xl text-sm leading-relaxed text-stone">Tell us what went wrong. Every request gets a ticket so you can follow the conversation from your account.</p>

          <form onSubmit={submit} className="mt-12 border border-line bg-charcoal p-6 sm:p-8">
            <div className="grid gap-5 sm:grid-cols-2">
              <label className="text-xs text-stone">CATEGORY<select value={category} onChange={(e) => setCategory(e.target.value as SupportCategory)} className="mt-2 w-full border border-line-strong bg-void px-3 py-3 text-sm text-bone"><option value="order">Order issue</option><option value="delivery">Delivery issue</option><option value="return">Return / exchange</option><option value="product">Product question</option><option value="size">Size issue</option><option value="other">Other</option></select></label>
              <label className="text-xs text-stone">SUBJECT<input value={subject} onChange={(e) => setSubject(e.target.value)} className="mt-2 w-full border border-line-strong bg-void px-3 py-3 text-sm text-bone" placeholder="What can we help with?" /></label>
            </div>
            <label className="mt-5 block text-xs text-stone">MESSAGE<textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={6} className="mt-2 w-full resize-y border border-line-strong bg-void px-3 py-3 text-sm text-bone" placeholder="Tell us what happened…" /></label>
            {error && <p className="mt-4 text-xs text-mango">{error}</p>}
            <button disabled={saving} className="mt-6 bg-bone px-7 py-3.5 text-xs font-medium tracking-[0.18em] text-void disabled:opacity-50">{saving ? "CREATING…" : "CREATE TICKET"}</button>
          </form>

          <section className="mt-14">
            <div className="mb-5 flex items-center justify-between"><p className="label-technical">YOUR TICKETS</p><Link href="/account" className="text-xs text-stone underline underline-offset-4 hover:text-bone">ACCOUNT</Link></div>
            {loading ? <p className="py-10 text-sm text-stone">Loading…</p> : tickets.length === 0 ? <p className="border border-line py-12 text-center text-sm text-stone">No support tickets yet.</p> : <div className="space-y-3">{tickets.map((ticket) => <article key={ticket.id} className="border border-line bg-charcoal p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-mono text-xs text-mango">#{ticket.id}</p><h2 className="mt-1 text-sm font-medium text-bone">{ticket.subject}</h2></div><span className="label-technical text-stone">{ticket.status.replace("_", " ")}</span></div><p className="mt-3 text-xs text-stone">{ticket.messages[ticket.messages.length - 1]?.text}</p></article>)}</div>}
          </section>
        </div>
      </main>
    </>
  );
}
