import { NextResponse } from "next/server";
import { isAuthenticated } from "@/app/lib/adminAuth";
import { getAllReturns } from "@/app/lib/returns";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ requests: await getAllReturns() });
}
