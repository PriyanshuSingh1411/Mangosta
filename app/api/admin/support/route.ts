import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/app/lib/adminAuth";
import { getAllTickets, updateTicketStatus, addTicketReply, type SupportStatus } from "@/app/lib/support";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await isAuthenticated())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ tickets: await getAllTickets() });
}

export async function PATCH(req: NextRequest) {
  if (!(await isAuthenticated())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => null);
  const id = String(body?.id || "");
  if (!id) return NextResponse.json({ error: "Ticket id is required." }, { status: 400 });
  if (body?.status) {
    const status = String(body.status) as SupportStatus;
    if (!["open", "in_progress", "resolved"].includes(status)) return NextResponse.json({ error: "Invalid status." }, { status: 400 });
    return NextResponse.json({ ticket: await updateTicketStatus(id, status) });
  }
  const text = String(body?.message || "").trim();
  if (!text) return NextResponse.json({ error: "Message is required." }, { status: 400 });
  return NextResponse.json({ ticket: await addTicketReply(id, "admin", text) });
}
