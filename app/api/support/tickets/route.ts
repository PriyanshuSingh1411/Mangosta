import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/app/lib/auth/session";
import { createTicket, getCustomerTickets, type SupportCategory } from "@/app/lib/support";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  return NextResponse.json({ tickets: await getCustomerTickets(user.id) }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  const body = await req.json().catch(() => null);
  const category = String(body?.category || "other");
  const allowed = ["order", "delivery", "return", "product", "size", "other"];
  if (!allowed.includes(category)) return NextResponse.json({ error: "Invalid support category." }, { status: 400 });
  const subject = String(body?.subject || "").trim();
  const message = String(body?.message || "").trim();
  if (subject.length < 3 || message.length < 5) return NextResponse.json({ error: "Please enter a subject and message." }, { status: 400 });
  return NextResponse.json({ ticket: await createTicket(user, { category: category as SupportCategory, subject, message }) }, { status: 201 });
}
