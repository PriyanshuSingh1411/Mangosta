import { NextRequest, NextResponse } from "next/server";
import { isAuthenticated } from "@/app/lib/adminAuth";
import {
  getStoreConfig,
  isStoreConfigKey,
  saveStoreConfig,
} from "@/app/lib/storeConfig";

type Context = { params: Promise<{ key: string }> };

/** GET /api/admin/store-config/{sizeGuide|delivery|returnsPolicy|emailAutomation} */
export async function GET(_req: NextRequest, { params }: Context) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { key } = await params;
  if (!isStoreConfigKey(key)) {
    return NextResponse.json({ error: "Unknown setting." }, { status: 404 });
  }

  return NextResponse.json(await getStoreConfig(key));
}

export async function PUT(req: NextRequest, { params }: Context) {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { key } = await params;
  if (!isStoreConfigKey(key)) {
    return NextResponse.json({ error: "Unknown setting." }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid body." }, { status: 400 });
  }

  return NextResponse.json(await saveStoreConfig(key, body));
}
