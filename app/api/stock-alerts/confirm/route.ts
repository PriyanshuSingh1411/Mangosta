import { NextRequest, NextResponse, after } from "next/server";
import { confirmStockAlert, notifyBackInStock } from "@/app/lib/stockAlerts";
import { isValidStockAlertToken } from "@/app/lib/emailPreferences";

export const dynamic = "force-dynamic";

/** POST /api/stock-alerts/confirm?id=<alert>&e=<email>&t=<signature> */
export async function POST(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get("id") ?? "";
    const email = (req.nextUrl.searchParams.get("e") ?? "").trim().toLowerCase();
    const token = req.nextUrl.searchParams.get("t") ?? "";

    if (!isValidStockAlertToken(id, email, token)) {
      return NextResponse.json({ error: "This link isn't valid." }, { status: 400 });
    }

    const alert = await confirmStockAlert(id, email);
    if (!alert) {
      return NextResponse.json(
        { error: "This alert no longer exists. You can ask again on the product page." },
        { status: 404 }
      );
    }

    // Already back in stock by the time they confirmed? Email now instead
    // of waiting for a restock that already happened (only sends when the
    // size really is available, and only to confirmed alerts).
    if (alert.notifiedAt === null) {
      after(() => notifyBackInStock([alert.productId]).then(() => undefined));
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("POST /api/stock-alerts/confirm failed:", error);
    return NextResponse.json(
      { error: "Couldn't confirm right now. Please try again in a moment." },
      { status: 500 }
    );
  }
}
