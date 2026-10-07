import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/app/lib/adminAuth";
import { answerProductQuestion, getAllProductQuestions } from "@/app/lib/productQuestions";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await isAuthenticated())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ questions: await getAllProductQuestions() });
}

export async function PATCH(req: NextRequest) {
  if (!(await isAuthenticated())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => null);
  const id = String(body?.id || "");
  const answer = String(body?.answer || "").trim();
  if (!id || !answer) return NextResponse.json({ error: "Question id and answer are required." }, { status: 400 });
  return NextResponse.json({ question: await answerProductQuestion(id, answer) });
}
