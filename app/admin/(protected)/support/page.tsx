"use client";

import { useEffect, useState } from "react";
type SupportStatus = "open" | "in_progress" | "resolved";
type SupportTicket = {
  id: string;
  userId: string;
  email: string;
  category: string;
  subject: string;
  status: SupportStatus;
  messages: { id: string; sender: "customer" | "admin"; text: string; createdAt: string }[];
  createdAt: string;
  updatedAt: string;
};

export default function AdminSupportPage() {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [reply, setReply] = useState<Record<string, string>>({});
  const load = () =>
    fetch("/api/admin/support", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setTickets(d.tickets || []));
  useEffect(() => {
    void load();
  }, []);

  const update = async (id: string, payload: { status?: SupportStatus; message?: string }) => {
    await fetch("/api/admin/support", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...payload }),
    });
    await load();
  };

  return (
    <div>
      <p className="label-technical mb-3">CUSTOMER CARE</p>
      <h1 className="type-heading">SUPPORT TICKETS</h1>
      <div className="mt-8 space-y-4">
        {tickets.map((ticket) => (
          <article key={ticket.id} className="border border-line bg-charcoal p-5">
            <div className="flex flex-wrap justify-between gap-3">
              <div>
                <p className="font-mono text-xs text-mango">#{ticket.id}</p>
                <h2 className="mt-1 font-medium">{ticket.subject}</h2>
                <p className="mt-1 text-xs text-stone">
                  {ticket.email} · {ticket.category}
                </p>
              </div>
              <select
                value={ticket.status}
                onChange={(e) => void update(ticket.id, { status: e.target.value as SupportStatus })}
                className="border border-line-strong bg-void px-3 py-2 text-xs"
              >
                <option value="open">Open</option>
                <option value="in_progress">In progress</option>
                <option value="resolved">Resolved</option>
              </select>
            </div>
            <div className="mt-5 space-y-3 border-t border-line pt-4">
              {ticket.messages.map((message) => (
                <div
                  key={message.id}
                  className={
                    message.sender === "admin"
                      ? "border-l border-mango pl-3"
                      : "border-l border-line-strong pl-3"
                  }
                >
                  <p className="text-xs text-stone">{message.sender.toUpperCase()}</p>
                  <p className="mt-1 text-sm text-bone-dim">{message.text}</p>
                </div>
              ))}
            </div>
            <div className="mt-5 flex gap-2">
              <input
                value={reply[ticket.id] || ""}
                onChange={(e) => setReply((r) => ({ ...r, [ticket.id]: e.target.value }))}
                className="min-w-0 flex-1 border border-line-strong bg-void px-3 py-2 text-xs"
                placeholder="Reply to customer…"
              />
              <button
                onClick={() => {
                  const text = reply[ticket.id]?.trim();
                  if (!text) return;
                  void update(ticket.id, { message: text }).then(() =>
                    setReply((r) => ({ ...r, [ticket.id]: "" })),
                  );
                }}
                className="border border-line-strong px-4 py-2 text-xs hover:border-bone"
              >
                REPLY
              </button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
