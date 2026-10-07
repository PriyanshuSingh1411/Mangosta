"use client";

import { useEffect, useRef } from "react";
import { useAuth } from "@/app/components/AuthProvider";
import { useCartStore } from "@/app/store/useCartStore";

/**
 * Keeps a copy of a signed-in customer's bag on the server so the
 * "you left something in your bag" email can be sent (Admin → Reminders).
 * Renders nothing.
 */
export default function CartSync() {
  const { user, loading } = useAuth();
  const lines = useCartStore((state) => state.lines);
  const lastSent = useRef<string>("");

  useEffect(() => {
    if (loading || !user) return;

    const payload = JSON.stringify(
      lines.map((line) => ({
        productId: line.product.id,
        color: line.color,
        size: line.size,
        quantity: line.quantity,
      }))
    );
    const key = `${user.id}:${payload}`;
    if (key === lastSent.current) return;

    const timer = window.setTimeout(() => {
      lastSent.current = key;
      void fetch("/api/cart", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: `{"lines":${payload}}`,
        keepalive: true,
      }).catch(() => {
        lastSent.current = "";
      });
    }, 1500);

    return () => window.clearTimeout(timer);
  }, [lines, user, loading]);

  return null;
}
