import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/app/lib/adminAuth";
import { deleteReview, setReviewReply, setReviewStatus } from "@/app/lib/reviews";

type Context = { params: Promise<{ id: string }> };

/**
 * PATCH /api/admin/reviews/:id
 *   { status: "published" | "hidden" }   show / hide
 *   { reply: "text" }                     Mangosta's public reply ("" removes it)
 */
export async function PATCH(req: NextRequest, { params }: Context) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const body = await req.json().catch(() => null);

  if (typeof body?.reply === "string") {
    if (body.reply.length > 1000) {
      return NextResponse.json({ error: "Keep the reply under 1000 characters." }, { status: 400 });
    }
    if (!(await setReviewReply(id, body.reply))) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  }

  const status = body?.status === "hidden" ? "hidden" : body?.status === "published" ? "published" : null;

  if (!status) {
    return NextResponse.json({ error: "status must be published or hidden." }, { status: 400 });
  }
  if (!(await setReviewStatus(id, status))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: Context) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  if (!(await deleteReview(id))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
