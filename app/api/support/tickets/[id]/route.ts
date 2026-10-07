import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/app/lib/auth/session";
import { addTicketReply, getCustomerTickets } from "@/app/lib/support";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  const { id } = await params;
  const owned = (await getCustomerTickets(user.id)).find((ticket) => ticket.id === id);
  if (!owned) return NextResponse.json({ error: "Ticket not found." }, { status: 404 });
  const body = await req.json().catch(() => null);
  const text = String(body?.message || "").trim();
  if (!text) return NextResponse.json({ error: "Message is required." }, { status: 400 });
  return NextResponse.json({ ticket: await addTicketReply(id, "customer", text) });
}
