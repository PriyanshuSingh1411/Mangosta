import { NextRequest, NextResponse } from "next/server";
import clientPromise from "@/app/lib/mongodb";
import { getCurrentUser } from "@/app/lib/auth/session";
import { randomUUID } from "crypto";

/** Account → saved addresses (signed-in customer only). */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  const db = (await clientPromise).db("mangosta");
  const addresses = await db
    .collection("addresses")
    .find({ userId: user.id }, { projection: { _id: 0 } })
    .sort({ createdAt: -1 })
    .toArray();
  return NextResponse.json({ addresses });
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  const b = await req.json().catch(() => null);
  const address = {
    id: `addr-${randomUUID()}`,
    userId: user.id,
    name: String(b?.name ?? "").trim().slice(0, 100),
    phone: String(b?.phone ?? "").trim().slice(0, 20),
    line1: String(b?.line1 ?? "").trim().slice(0, 200),
    line2: String(b?.line2 ?? "").trim().slice(0, 200),
    city: String(b?.city ?? "").trim().slice(0, 60),
    state: String(b?.state ?? "").trim().slice(0, 60),
    pincode: String(b?.pincode ?? "").trim(),
    createdAt: new Date().toISOString(),
  };
  if (
    !address.name ||
    !address.phone ||
    !address.line1 ||
    !address.city ||
    !address.state ||
    !/^[0-9]{6}$/.test(address.pincode)
  )
    return NextResponse.json({ error: "Complete all required address fields." }, { status: 400 });
  const db = (await clientPromise).db("mangosta");
  await db.collection("addresses").insertOne(address);
  return NextResponse.json({ address });
}

export async function DELETE(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Address id required" }, { status: 400 });
  const db = (await clientPromise).db("mangosta");
  await db.collection("addresses").deleteOne({ id, userId: user.id });
  return NextResponse.json({ success: true });
}
