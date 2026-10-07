"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/app/components/AuthProvider";

export default function NotificationBell() {
  const { user } = useAuth();
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!user) { setCount(0); return; }
    fetch("/api/notifications", { cache: "no-store" }).then((r) => r.json()).then((data) => {
      const notifications = Array.isArray(data?.notifications) ? data.notifications : [];
      const seen = JSON.parse(window.localStorage.getItem("mangosta-notifications-seen") || "[]") as string[];
      setCount(notifications.filter((item: { id: string }) => !seen.includes(item.id)).length);
    }).catch(() => undefined);
  }, [user]);

  if (!user) return null;
  return <Link href="/notifications" aria-label={`Notifications${count ? `, ${count} unread` : ""}`} className="relative flex h-8 w-8 items-center justify-center text-bone-dim hover:text-bone"><svg viewBox="0 0 24 24" className="h-[17px] w-[17px]" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4" strokeLinecap="round"/></svg>{count > 0 && <span className="absolute -right-1 -top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-mango px-1 font-mono text-[9px] font-bold text-void">{count > 9 ? "9+" : count}</span>}</Link>;
}
