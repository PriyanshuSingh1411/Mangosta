import { NextResponse } from "next/server";
import { isAuthenticated } from "@/app/lib/adminAuth";
import { getAllReviews } from "@/app/lib/reviews";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ reviews: await getAllReviews() });
}
