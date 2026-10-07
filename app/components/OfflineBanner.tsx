"use client";
import { useEffect, useState } from "react";
export default function OfflineBanner() {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => { window.removeEventListener("online", update); window.removeEventListener("offline", update); };
  }, []);
  if (online) return null;
  return <div role="status" className="fixed inset-x-0 bottom-0 z-[10010] border-t border-mango bg-void px-4 py-3 text-center text-xs tracking-wide text-bone">You’re offline. Your saved bag and wishlist remain available, but some live updates may be unavailable.</div>;
}
