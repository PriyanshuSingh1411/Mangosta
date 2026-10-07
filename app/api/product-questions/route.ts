import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/app/lib/auth/session";
import { getProduct } from "@/app/lib/dataStore";
import { createProductQuestion, getProductQuestions } from "@/app/lib/productQuestions";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const productId = req.nextUrl.searchParams.get("productId") || "";
  if (!productId) return NextResponse.json({ error: "productId is required." }, { status: 400 });
  return NextResponse.json({ questions: await getProductQuestions(productId) }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in to ask a question." }, { status: 401 });
  const body = await req.json().catch(() => null);
  const productId = String(body?.productId || "");
  const question = String(body?.question || "").trim();
  if (!(await getProduct(productId))) return NextResponse.json({ error: "Product not found." }, { status: 404 });
  if (question.length < 5) return NextResponse.json({ error: "Please ask a little more detail." }, { status: 400 });
  return NextResponse.json({ question: await createProductQuestion(user, productId, question) }, { status: 201 });
}
