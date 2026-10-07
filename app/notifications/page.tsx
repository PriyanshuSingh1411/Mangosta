"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Navigation from "@/app/components/Navigation";
import { trackEngagement } from "@/app/lib/trackEngagement";
type Notification = { id: string; type: string; title: string; body: string; href: string; createdAt: string; priority: "high" | "normal" };

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const openTracked = useRef(false);
  useEffect(() => {
    fetch("/api/notifications", { cache: "no-store" }).then((r) => r.json()).then((d) => {
      const list: Notification[] = d.notifications || [];
      const seen = JSON.parse(window.localStorage.getItem("mangosta-notifications-seen") || "[]") as string[];
      setNotifications(list);
      window.localStorage.setItem("mangosta-notifications-seen", JSON.stringify(list.map((item: Notification) => item.id)));
      if (!openTracked.current) {
        openTracked.current = true;
        void trackEngagement({
          event: "notification_open",
          path: "/notifications",
          metadata: {
            notificationCount: list.length,
            unreadCount: list.filter((item) => !seen.includes(item.id)).length,
          },
        });
      }
    }).finally(() => setLoading(false));
  }, []);
  const trackClick = (item: Notification) =>
    void trackEngagement({
      event: "notification_click",
      path: "/notifications",
      metadata: { notificationId: item.id, notificationType: item.type, href: item.href, priority: item.priority },
    });
  return <><Navigation /><main id="main-content" className="min-h-screen bg-void px-5 pb-24 pt-32 sm:px-8 sm:pt-40"><div className="mx-auto max-w-4xl"><p className="label-technical mb-4">MANGOSTA / ACCOUNT</p><div className="flex items-end justify-between gap-4 border-b border-line pb-7"><h1 className="font-display text-5xl tracking-tight text-bone sm:text-7xl">NOTIFICATIONS</h1><Link href="/account" className="label-technical text-stone hover:text-bone">ACCOUNT</Link></div>{loading ? <p className="py-16 text-sm text-stone">Loading…</p> : notifications.length === 0 ? <div className="py-20 text-center"><p className="text-sm text-stone">You’re all caught up.</p></div> : <div className="mt-8 divide-y divide-line border-y border-line">{notifications.map((item) => <Link key={item.id} href={item.href} onClick={() => trackClick(item)} className="block px-2 py-6 transition-colors hover:bg-charcoal"><div className="flex gap-4"><span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${item.priority === "high" ? "bg-mango" : "bg-line-strong"}`} /><div><p className="text-sm font-medium text-bone">{item.title}</p><p className="mt-1 text-sm leading-relaxed text-stone">{item.body}</p><p className="mt-2 text-[10px] text-stone-dark">{new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" }).format(new Date(item.createdAt))}</p></div></div></Link>)}</div>}</div></main></>;
}
