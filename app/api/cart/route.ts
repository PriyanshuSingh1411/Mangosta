import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/app/lib/auth/session";
import { saveCustomerCart } from "@/app/lib/bagReminders";
import type { SavedCartLine } from "@/app/lib/bagReminders";

/**
 * PUT /api/cart { lines: [{ productId, color, size, quantity }] }
 * Keeps a copy of a signed-in customer's bag for the reminder email.
 * Guests are ignored (there is no email to remind).
 */
export async function PUT(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ ok: true, saved: false });

  const body = await req.json().catch(() => null);
  const raw: unknown[] = Array.isArray(body?.lines) ? body.lines : [];

  const lines: SavedCartLine[] = raw
    .slice(0, 50)
    .map((item) => {
      const line = (item && typeof item === "object" ? item : {}) as Record<string, unknown>;
      return {
        productId: String(line.productId ?? "").slice(0, 40),
        color: String(line.color ?? "").slice(0, 60),
        size: String(line.size ?? "").slice(0, 20),
        quantity: Math.min(99, Math.max(1, Math.floor(Number(line.quantity) || 1))),
      };
    })
    .filter((line) => line.productId);

  await saveCustomerCart(user, lines);
  return NextResponse.json({ ok: true, saved: true });
}
